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
  const { email, username, phone, firstName, lastName, password, role } =
    req.body;
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

    const newUser = { email, username, firstName, lastName, phone, password };
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
  const { name, userData, phone, firstName, lastName, location, role } = req.body;

  // Validate input
  if (!name || !userData || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const collectionName = role === "merchant" ? "MerchantDetails" : "ClientDetails";
    
    // Fetch user document
    const userDoc = await db
      .collection(collectionName)
      .where("username", "==", name)
      .get();

    // Check if the user exists
    if (userDoc.empty) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the document with the new data
    const docRef = userDoc.docs[0].ref;
    await docRef.update({
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      maritalStatus: userData.maritalStatus,
      monthlyIncome: userData.monthlyIncome,
      employmentType: userData.employmentType,
      location:userData.location,
    });

    res.status(200).json({ message: "Profile updated successfully!" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});



// Get profile for client
app.get("/getClientProfile", async (req, res) => {
  const { username } = req.query;

  try {
    const userDoc = await db
      .collection("ClientDetails")
      .where("username", "==", username)
      .get();
    if (userDoc.empty) {
      return res.status(404).json({ message: "Client not found." });
    }

    const userData = userDoc.docs[0].data();
    res.status(200).json(userData);
  } catch (error) {
    console.error("Error fetching client profile data:", error);
    res.status(500).json({ message: "Failed to fetch client profile data" });
  }
});

// Get profile for merchant
app.get("/getMerchantProfile", async (req, res) => {
  const { username } = req.query;

  try {
    const userDoc = await db
      .collection("MerchantDetails")
      .where("username", "==", username)
      .get();
    if (userDoc.empty) {
      return res.status(404).json({ message: "Merchant not found." });
    }

    const userData = userDoc.docs[0].data();
    res.status(200).json(userData);
  } catch (error) {
    console.error("Error fetching merchant profile data:", error);
    res.status(500).json({ message: "Failed to fetch merchant profile data" });
  }
});
app.get("/searchMerchants", async (req, res) => {
  const { location, loanAmount, merchantName } = req.query;

  try {
    let queryRef = db.collection("MerchantDetails");

    // Create dynamic queries based on the provided search fields
    const locationQuery = location
      ? queryRef.where("location", "==", location)
      : null;
    const loanAmountQuery = loanAmount
      ? queryRef.where("loanAmount", "==", loanAmount)
      : null;
    const merchantNameQuery = merchantName
      ? queryRef.where("name", "==", merchantName) // Updated to use "name" field
      : null;

    // Collect all non-null queries
    const queries = [locationQuery, loanAmountQuery, merchantNameQuery].filter(
      Boolean
    );

    let merchantDocs = [];
    for (const query of queries) {
      const snapshot = await query.get();
      snapshot.forEach((doc) => {
        if (!merchantDocs.some((existingDoc) => existingDoc.id === doc.id)) {
          merchantDocs.push({ id: doc.id, ...doc.data() });
        }
      });
    }

    res.status(200).json(merchantDocs);
  } catch (error) {
    console.error("Error searching merchants:", error);
    res.status(500).json({ message: "Failed to search merchants" });
  }
});
app.post("/applyLoan", async (req, res) => {
  const {
    applicantUsername,
    applicantEmail,
    loanAmount,
    merchantName,
    applicantRole,
  } = req.body;

  // Validate that required fields are present
  if (
    !applicantUsername ||
    !applicantEmail ||
    !loanAmount ||
    !merchantName ||
    !applicantRole
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Add the loan application to Firestore
    await db.collection("Applications").add({
      applicantUsername,
      applicantEmail,
      loanAmount,
      merchantName,
      applicantRole,
      status: "Pending",
      appliedAt: new Date(),
    });

    res.status(200).json({ message: "Application submitted successfully!" });
  } catch (error) {
    console.error("Error saving application:", error.message);
    res.status(500).json({ error: "Failed to save application" });
  }
});

app.post("/getLoans", async (req, res) => {
  const { username, email, role } = req.body;

  try {
    const applicationsQuery = await db
      .collection("Applications")
      .where("applicantUsername", "==", username)
      .where("applicantEmail", "==", email)
      .where("applicantRole", "==", role)
      .get();

    const applications = [];
    applicationsQuery.forEach((doc) => {
      const data = doc.data();
      // Convert Firestore Timestamp to a readable date
      if (data.dateOfApply && data.dateOfApply.toDate) {
        data.dateOfApply = data.dateOfApply.toDate().toISOString();
      }
      applications.push({ id: doc.id, ...data });
    });

    res.status(200).json(applications);
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Failed to fetch loan applications" });
  }
});

// Withdraw a loan application
app.post("/withdrawLoan", async (req, res) => {
  const { loanId } = req.body;

  try {
    const loanRef = db.collection("Applications").doc(loanId);
    await loanRef.delete();
    res
      .status(200)
      .json({ message: "Loan application withdrawn successfully!" });
  } catch (error) {
    console.error("Error withdrawing loan:", error);
    res.status(500).json({ error: "Failed to withdraw loan" });
  }
});

app.post("/getMerchantLoans", async (req, res) => {
  const { merchantName } = req.body;

  console.log("Received request to fetch loans for merchant:", merchantName);

  if (!merchantName) {
    return res.status(400).json({ error: "Merchant name is required" });
  }

  try {
    const applicationsQuery = await db
      .collection("Applications")
      .where("merchantName", "==", merchantName.trim())
      .get();

    console.log(
      `Found ${applicationsQuery.size} applications for merchant: ${merchantName}`
    );

    const applications = [];
    applicationsQuery.forEach((doc) => {
      const data = doc.data();
      console.log("Fetched application:", data);
      applications.push({ id: doc.id, ...data });
    });

    res.status(200).json(applications);
  } catch (error) {
    console.error("Error fetching merchant loans:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

app.post("/updateLoanStatus", async (req, res) => {
  const { loanId, status } = req.body;

  try {
    const loanRef = db.collection("Applications").doc(loanId);
    await loanRef.update({ status });
    res.status(200).json({ message: "Loan status updated successfully!" });
  } catch (error) {
    console.error("Error updating loan status:", error);
    res.status(500).json({ error: "Failed to update loan status" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
