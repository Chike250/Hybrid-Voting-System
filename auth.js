const express = require("express")
const router = express.Router()
const { body, validationResult } = require("express-validator")
const {
  generateECCKeyPair,
  signMessage,
  verifySignature,
  encryptAES,
  hashPassword,
  verifyPassword,
  generateJWT,
  decryptAES,
} = require("../utils/security")

// Registration
router.post(
  "/register",
  [
    body("nin").isLength({ min: 11, max: 11 }).withMessage("NIN must be 11 characters long"),
    body("vin").isLength({ min: 19, max: 19 }).withMessage("VIN must be 19 characters long"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      const { nin, vin, password } = req.body

      // Check if user already exists
      const { data: existingUser } = await req.supabase
        .from("voters")
        .select("id")
        .eq("nin", encryptAES(nin, process.env.AES_KEY))
        .single()

      if (existingUser) {
        return res.status(400).json({ error: "User already exists" })
      }

      // Generate unique voter ID
      const voterId = generateUniqueVoterId()

      // Generate ECC key pair
      const { privateKey, publicKey } = generateECCKeyPair()

      // Hash password
      const hashedPassword = await hashPassword(password)

      // Encrypt sensitive data
      const encryptedNin = encryptAES(nin, process.env.AES_KEY)
      const encryptedVin = encryptAES(vin, process.env.AES_KEY)

      // Insert user into database
      const { data, error } = await req.supabase.from("voters").insert({
        nin: encryptedNin,
        vin: encryptedVin,
        voter_id: voterId,
        password: hashedPassword,
        public_key: publicKey,
      })

      if (error) throw error

      res.status(201).json({ message: "User registered successfully", voterId })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: "An error occurred during registration" })
    }
  },
)

// Login
router.post(
  "/login",
  [
    body("nin").isLength({ min: 11, max: 11 }).withMessage("NIN must be 11 characters long"),
    body("vin").isLength({ min: 19, max: 19 }).withMessage("VIN must be 19 characters long"),
    body("voterId").notEmpty().withMessage("Voter ID is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      const { nin, vin, voterId, password } = req.body

      // Retrieve user from database
      const { data: user, error } = await req.supabase.from("voters").select("*").eq("voter_id", voterId).single()

      if (error || !user) {
        return res.status(401).json({ error: "Invalid credentials" })
      }

      // Decrypt and verify NIN and VIN
      const decryptedNin = decryptAES(user.nin, process.env.AES_KEY)
      const decryptedVin = decryptAES(user.vin, process.env.AES_KEY)

      if (decryptedNin !== nin || decryptedVin !== vin) {
        return res.status(401).json({ error: "Invalid credentials" })
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password)
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" })
      }

      // Generate JWT
      const token = generateJWT({ userId: user.id, voterId: user.voter_id })

      res.json({ token })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: "An error occurred during login" })
    }
  },
)

// Logout (optional, as JWT is stateless)
router.post("/logout", (req, res) => {
  // In a real-world scenario, you might want to invalidate the token on the client-side
  res.json({ message: "Logged out successfully" })
})

function generateUniqueVoterId() {
  // Implement a function to generate a unique voter ID
  // This could be a combination of random numbers and letters
  return "V" + Math.random().toString(36).substr(2, 8).toUpperCase()
}

module.exports = router

