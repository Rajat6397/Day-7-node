const express = require("express");
const mongoose = require("mongoose");
const shortid = require("shortid");

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// MongoDB connection (replace with your MongoDB URI)
mongoose.connect("mongodb://localhost/urlshortener", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schema to store URLs
const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortUrl: { type: String, required: true, unique: true },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
});

// Model for the URLs
const Url = mongoose.model("Url", urlSchema);

// Route to create a short URL
app.post("/shorten", async (req, res) => {
  const { originalUrl, customAlias, expiresInDays } = req.body;

  // Generate a unique short code
  let shortCode = customAlias || shortid.generate();
  const shortUrl = `${req.protocol}://${req.get("host")}/${shortCode}`;

  // Check if the custom alias already exists
  const existingAlias = await Url.findOne({ shortUrl });
  if (existingAlias) {
    return res.status(400).json({ message: "Custom alias already exists." });
  }

  // Optional expiration date
  let expiresAt;
  if (expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  const newUrl = new Url({
    originalUrl,
    shortUrl,
    expiresAt,
  });

  try {
    await newUrl.save();
    res.json({ originalUrl, shortUrl });
  } catch (err) {
    res.status(500).json({ message: "Error creating short URL" });
  }
});

// Route to handle redirection
app.get("/:shortCode", async (req, res) => {
  const shortUrl = `${req.protocol}://${req.get("host")}/${req.params.shortCode}`;

  try {
    const urlEntry = await Url.findOne({ shortUrl });

    if (!urlEntry) {
      return res.status(404).json({ message: "URL not found" });
    }

    // Check for expiration
    if (urlEntry.expiresAt && new Date() > urlEntry.expiresAt) {
      return res.status(410).json({ message: "URL has expired" });
    }

    // Increment click count
    urlEntry.clicks++;
    await urlEntry.save();

    // Redirect to the original URL
    res.redirect(urlEntry.originalUrl);
  } catch (err) {
    res.status(500).json({ message: "Error redirecting to the original URL" });
  }
});

// Route to track usage analytics
app.get("/analytics/:shortCode", async (req, res) => {
  const shortUrl = `${req.protocol}://${req.get("host")}/${req.params.shortCode}`;

  try {
    const urlEntry = await Url.findOne({ shortUrl });

    if (!urlEntry) {
      return res.status(404).json({ message: "URL not found" });
    }

    res.json({
      originalUrl: urlEntry.originalUrl,
      shortUrl: urlEntry.shortUrl,
      clicks: urlEntry.clicks,
      createdAt: urlEntry.createdAt,
      expiresAt: urlEntry.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching analytics" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
