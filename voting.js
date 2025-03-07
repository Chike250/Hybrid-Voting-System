const express = require("express")
const router = express.Router()
const { body, validationResult } = require("express-validator")
const { encryptAES, decryptAES } = require("../utils/security")

// Cast vote
router.post("/cast", [body("candidateId").notEmpty().withMessage("Candidate ID is required")], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  try {
    const { candidateId } = req.body
    const { userId, voterId } = req.user

    // Check if user has already voted
    const { data: existingVote } = await req.supabase.from("votes").select("id").eq("voter_id", voterId).single()

    if (existingVote) {
      return res.status(400).json({ error: "You have already cast your vote" })
    }

    // Encrypt the vote
    const encryptedVote = encryptAES(candidateId, process.env.AES_KEY)

    // Insert vote into database
    const { data, error } = await req.supabase.from("votes").insert({
      voter_id: voterId,
      candidate_id: encryptedVote,
      timestamp: new Date(),
    })

    if (error) throw error

    res.json({ message: "Vote cast successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "An error occurred while casting the vote" })
  }
})

// Get election results
router.get("/results", async (req, res) => {
  try {
    // Retrieve all votes
    const { data: votes, error } = await req.supabase.from("votes").select("candidate_id")

    if (error) throw error

    // Decrypt and count votes
    const results = votes.reduce((acc, vote) => {
      const candidateId = decryptAES(vote.candidate_id, process.env.AES_KEY)
      acc[candidateId] = (acc[candidateId] || 0) + 1
      return acc
    }, {})

    res.json(results)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "An error occurred while retrieving results" })
  }
})

module.exports = router

