// Load environment variables from a .env file
require("dotenv").config();
const https = require("https");
const fs = require("fs");
const path = require("path");
// Import required modules
const express = require("express");
const { google } = require("googleapis");

const privateKeyPath = path.resolve(__dirname, "certificates/key.pem");
const certificatePath = path.resolve(__dirname, "certificates/cert.pem");

const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const certificate = fs.readFileSync(certificatePath, "utf8");
const credentials = { key: privateKey, cert: certificate };

// Initialize Express app
const app = express();

// Create HTTPS server
const httpsServer = https.createServer(credentials, app);

// Set up Google OAuth2 client with credentials from environment variables
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.SECRET_ID,
  process.env.REDIRECT
);

// Route to initiate Google OAuth2 flow
app.get("/", (req, res) => {
  // Generate the Google authentication URL
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // Request offline access to receive a refresh token
    scope: "https://www.googleapis.com/auth/calendar.readonly", // Scope for read-only access to the calendar
  });
  // Redirect the user to Google's OAuth 2.0 server
  res.redirect(url);
});

// Route to handle the OAuth2 callback
app.get("/redirect", (req, res) => {
  // Extract the code from the query parameter
  const code = req.query.code;
  // Exchange the code for tokens
  console.log(`req.query`, req.query);
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      // Handle error if token exchange fails
      console.error("Couldn't get token", err);
      res.send("Error");
      return;
    }
    // Set the credentials for the Google API client
    oauth2Client.setCredentials(tokens);
    console.log("token", tokens);
    // Notify the user of a successful login
    res.send("Successfully logged in");
  });
});

// Route to list all calendars
app.get("/calendars", (req, res) => {
  // Create a Google Calendar API client
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  // List all calendars
  calendar.calendarList.list({}, (err, response) => {
    if (err) {
      // Handle error if the API request fails
      console.error("Error fetching calendars", err);
      res.end("Error!");
      return;
    }
    // Send the list of calendars as JSON
    const calendars = response.data.items;
    res.json(calendars);
  });
});

// Route to list events from a specified calendar
app.get("/events", (req, res) => {
  // Get the calendar ID from the query string, default to 'primary'
  const calendarId = req.query.calendar ?? "primary";
  // Create a Google Calendar API client
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  // List events from the specified calendar
  calendar.events.list(
    {
      calendarId,
      timeMin: new Date().toISOString(),
      maxResults: 15,
      singleEvents: true,
      orderBy: "startTime",
    },
    (err, response) => {
      if (err) {
        // Handle error if the API request fails
        console.error("Can't fetch events");
        res.send("Error");
        return;
      }
      // Send the list of events as JSON
      const events = response.data.items;
      res.json(events);
    }
  );
});

// Route to refresh the access token
app.get("/refresh-token", (req, res) => {
  // Extract the refresh token from the query parameter or from environment variables
  const refreshToken =
    req.query.refresh_token ?? oauth2Client.credentials.refresh_token;
  if (!refreshToken) {
    res.status(400).send("Refresh token is required");
    return;
  }

  // Set the refresh token in the OAuth2 client
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Refresh the access token
  oauth2Client.refreshAccessToken((err, tokens) => {
    if (err) {
      console.error("Error refreshing access token", err);
      res.status(500).send("Failed to refresh access token");
      return;
    }
    // Set the new tokens in the OAuth2 client
    oauth2Client.setCredentials(tokens);
    // Return the new tokens as JSON
    res.json(tokens);
  });
});

// Start the Express server
httpsServer.listen(3000, () => console.log("Server running at 3000"));
// https://www.youtube.com/watch?v=2byT7fYT8UE
