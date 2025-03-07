require("dotenv").config()
const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const { createClient } = require("@supabase/supabase-js")
const swaggerUi = require("swagger-ui-express")
const swaggerJsdoc = require("swagger-jsdoc")

const authRoutes = require("./routes/auth")
const votingRoutes = require("./routes/voting")
const ussdRoutes = require("./routes/ussd")
const { verifyJWT } = require("./utils/security")

const app = express()

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://voting-system-frontend.vercel.app",
    optionsSuccessStatus: 200,
  }),
)
app.use(helmet())
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})
app.use(limiter)

// Supabase client initialization
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

// Make supabase client available in req object
app.use((req, res, next) => {
  req.supabase = supabase
  next()
})

// JWT verification middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader) {
    const token = authHeader.split(" ")[1]
    try {
      const user = verifyJWT(token)
      req.user = user
      next()
    } catch (error) {
      return res.status(403).json({ error: "Invalid or expired token" })
    }
  } else {
    res.status(401).json({ error: "Authorization header is missing" })
  }
}

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/voting", authenticateJWT, votingRoutes)
app.use("/api/ussd", ussdRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() })
})

// Swagger setup
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Voting System API",
      version: "1.0.0",
      description: "API for Hybrid Encryption-Based Voting System",
    },
    servers: [
      {
        url: process.env.NODE_ENV === "production" ? process.env.API_URL : "http://localhost:3000",
        description: "API Server",
      },
    ],
  },
  apis: ["./routes/*.js"], // Path to the API docs
}

const specs = swaggerJsdoc(options)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs))

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: "An unexpected error occurred" })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

module.exports = app

