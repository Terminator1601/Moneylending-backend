const express = require("express");
const db = require("./firebase");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Register a new user
app.post("/register", async (req, res) => {
  const { email, username, phone, password, role } = req.body;
  const collectionName =
    role === "client" ? "ClientDetails" : "MerchantDetails";

  try {
    const userQuery = await db
      .collection(collectionName)
      .where("email", "==", email)
      .get();
    if (!userQuery.empty) {
      return res
        .status(400)
        .json({ message: "Email already registered. Please log in." });
    }

    const newUser = { email, username, phone, password };
    await db.collection(collectionName).add(newUser);
    res.status(200).json({ message: "Registration successful!" });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

// Login an existing user
app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  const collectionName =
    role === "client" ? "ClientDetails" : "MerchantDetails";

  try {
    const userQuery = await db
      .collection(collectionName)
      .where("email", "==", email)
      .get();
    if (userQuery.empty) {
      return res
        .status(404)
        .json({ message: "Email not registered. Please register." });
    }

    const userData = userQuery.docs[0].data();
    if (userData.password !== password) {
      return res.status(400).json({ message: "Invalid password" });
    }

    res.status(200).json({
      message: `Welcome ${userData.username}!`,
      username: userData.username,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

app.get("/test-connection", async (req, res) => {
  try {
    const snapshot = await db.collection("YourCollectionName").limit(1).get();
    if (snapshot.empty) {
      res
        .status(200)
        .json({ message: "No documents found in the collection." });
    } else {
      res.status(200).json({ message: "Connected to Firestore successfully!" });
    }
  } catch (error) {
    console.error("Error connecting to Firestore:", error);
    res.status(500).json({
      message: "Failed to connect to Firestore",
      error: error.message,
    });
  }
});

app.post("/updateProfile", async (req, res) => {
  const { username, email, userData } = req.body; // Destructure username, email, and userData from request body

  try {
    // Find the document based on username and email
    const userDoc = await db
      .collection("ClientDetails")
      .where("username", "==", username)
      .where("email", "==", email)
      .get();

    if (userDoc.empty) {
      // If no document found, return an error
      return res
        .status(404)
        .json({ error: "User not found or email mismatch" });
    }

    // Get the document reference for the first matching document
    const docRef = userDoc.docs[0].ref;

    // Update the document with new userData
    await docRef.update(userData);
    res.status(200).json({ message: "Profile updated successfully!" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.get("/getProfile", async (req, res) => {
  const { username } = req.query;

  try {
    const userDoc = await db
      .collection("ClientDetails")
      .where("username", "==", username)
      .get();
    if (userDoc.empty) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userDoc.docs[0].data();
    res.status(200).json(userData);
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.status(500).json({ message: "Failed to fetch profile data" });
  }
});

app.get("/searchMerchants", async (req, res) => {
  const { location, loanAmount, merchantName } = req.query;

  try {
    let queryRef = db.collection("MerchantDetails");

    // Perform a union search for any matching field
    const locationQuery = location
      ? queryRef.where("location", "==", location)
      : null;
    const loanAmountQuery = loanAmount
      ? queryRef.where("loanAmount", "==", loanAmount)
      : null;
    const merchantNameQuery = merchantName
      ? queryRef.where("merchantName", "==", merchantName)
      : null;

    // Collect all queries that are non-null
    const queries = [locationQuery, loanAmountQuery, merchantNameQuery].filter(
      Boolean
    );

    // Get unique results from Firestore for each matching condition
    let merchantDocs = [];
    for (const query of queries) {
      const snapshot = await query.get();
      snapshot.forEach((doc) => {
        if (!merchantDocs.some((existingDoc) => existingDoc.id === doc.id)) {
          merchantDocs.push({ id: doc.id, ...doc.data() });
        }
      });
    }

    // Respond with matching merchant documents
    res.status(200).json(merchantDocs);
  } catch (error) {
    console.error("Error searching merchants:", error);
    res.status(500).json({ message: "Failed to search merchants" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});