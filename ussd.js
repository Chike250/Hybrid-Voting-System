const express = require("express")
const router = express.Router()
const { encryptAES, decryptAES } = require("../utils/security")

router.post("/callback", async (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body

    let response = ""

    const textArray = text.split("*")
    const level = textArray.length

    if (text === "") {
      response = `CON Welcome to the e-Voting System
      1. Verify registration
      2. Cast vote
      3. View results`
    } else if (text === "1") {
      response = `CON Enter your Voter ID:`
    } else if (level === 2 && textArray[0] === "1") {
      const voterId = textArray[1]
      const { data: voter } = await req.supabase.from("voters").select("id").eq("voter_id", voterId).single()

      if (voter) {
        response = `END You are registered to vote.`
      } else {
        response = `END Voter ID not found. Please register online.`
      }
    } else if (text === "2") {
      response = `CON Enter your Voter ID:`
    } else if (level === 2 && textArray[0] === "2") {
      const voterId = textArray[1]
      const { data: voter } = await req.supabase.from("voters").select("id").eq("voter_id", voterId).single()

      if (voter) {
        const { data: candidates } = await req.supabase.from("candidates").select("id, name")

        response = `CON Select a candidate to vote for:
        ${candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n")}`
      } else {
        response = `END Voter ID not found. Please register online.`
      }
    } else if (level === 3 && textArray[0] === "2") {
      const voterId = textArray[1]
      const candidateIndex = Number.parseInt(textArray[2]) - 1

      const { data: candidates } = await req.supabase.from("candidates").select("id, name")

      if (candidateIndex >= 0 && candidateIndex < candidates.length) {
        const candidateId = candidates[candidateIndex].id
        const encryptedVote = encryptAES(candidateId, process.env.AES_KEY)

        const { error } = await req.supabase.from("votes").insert({
          voter_id: voterId,
          candidate_id: encryptedVote,
          timestamp: new Date(),
        })

        if (error) {
          response = `END An error occurred while casting your vote. Please try again.`
        } else {
          response = `END Your vote has been cast successfully.`
        }
      } else {
        response = `END Invalid candidate selection. Please try again.`
      }
    } else if (text === "3") {
      const { data: votes } = await req.supabase.from("votes").select("candidate_id")

      const results = votes.reduce((acc, vote) => {
        const candidateId = decryptAES(vote.candidate_id, process.env.AES_KEY)
        acc[candidateId] = (acc[candidateId] || 0) + 1
        return acc
      }, {})

      const { data: candidates } = await req.supabase.from("candidates").select("id, name")

      response = `END Current Election Results:
      ${candidates.map((c) => `${c.name}: ${results[c.id] || 0} votes`).join("\n")}`
    } else {
      response = `END Invalid input. Please try again.`
    }

    res.set("Content-Type: text/plain")
    res.send(response)
  } catch (error) {
    console.error("USSD Error:", error)
    res.set("Content-Type: text/plain")
    res.send("END An error occurred. Please try again later.")
  }
})

module.exports = router

