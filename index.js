const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const multer = require("multer");
const { ObjectId } = require("mongodb");
const path = require("path");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const pdfjs = require("pdfjs-dist");
const PDFParser = require("pdf-parse");

require("dotenv").config();

const port = process.env.PORT || 4000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

// Configure Multer middleware
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

if (uri) {
  console.log("mongodb connected");
}

async function run() {
  try {
    await client.connect(); // establish connection to MongoDB Atlas cluster
    const informationCollection = client.db("icst").collection("information");
    const applicationCollection = client.db("icst").collection("application");
    const noticeCollection = client.db("icst").collection("notice");
    const contactCollection = client.db("icst").collection("contact");

    // Define Twilio credentials
    const accountSid = "ACa2040a87b03b3e43b6d5076e5074ac5d";
    const authToken = "f3a3100a4cce58b1518703af83bdba7f";

    // Create Twilio client
    const twilioClient = require("twilio")(accountSid, authToken);

    app.get("/", async (req, res) => {
      res.send("icst server is running");
    });

    app.post("/signupinformation", upload.single("img"), async (req, res) => {
      const {
        name,
        collegeId,
        email,
        yourNumber,
        motherNumber,
        fatherNumber,
        address,
        department,
        semester,
        hostel,
      } = req.body;

      const file = req.file;
      const fileName = file ? file.originalname : null;
      const fileContent = file ? file.buffer : null;

      const document = {
        name: name,
        collegeId: collegeId,
        email: email,
        phone: yourNumber,
        motherNumber: motherNumber,
        fatherNumber: fatherNumber,
        address: address,
        department: department,
        semester: semester,
        hostel: hostel,
        img: fileContent,
      };
      console.log(document);
      await informationCollection.insertOne(document);

      res.send({
        message: "User has been successfully registered",
      });
    });

    app.get("/search-student", async (req, res) => {
      const query = req.query.query;
      const regex = new RegExp(query, "i");

      const searchResults = await informationCollection
        .find({
          $or: [
            { name: regex },
            { collegeId: regex },
            { email: regex },
            { yourNumber: regex },
            { motherNumber: regex },
            { fatherNumber: regex },
            { address: regex },
            { department: regex },
            { semester: regex },
            { hostel: regex },
          ],
        })
        .toArray();

      res.send(searchResults);
    });

    app.post("/signin", async (req, res) => {
      const { collegeId, email } = req.body;

      try {
        const user = await informationCollection.findOne({ collegeId, email });

        if (user) {
          // College ID and email match, sign-in successful
          res.send({
            message: "Sign-in successful",
            user,
          });
        } else {
          // College ID or email is incorrect, sign-in failed
          res.status(401).send({ message: "Invalid sign-in credentials" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "An error occurred during sign-in" });
      }
    });

    app.post("/submit-application", async (req, res) => {
      try {
        const {
          firstname,
          email,
          address,
          languages,
          gender,
          birthDay,
          birthMonth,
          birthYear,
          highSchool,
          graduationDate,
          schoolAddress,
          paymentMethod,
        } = req.body;

        console.log("Form Data:", req.body); // Debugging: Log the form data received from the client

        const file = req.file;
        const signatureData = file ? file.buffer : null;

        const formData = req.body; // Get the form data from the request body

        // Save the form data to the database
        const result = await applicationCollection.insertOne(formData);

        if (result.insertedCount === 1) {
          // Form submission successful
          res
            .status(200)
            .json({ message: "Application submitted successfully!" });
        } else {
          // Form submission failed
          res.status(500).json({ message: "Failed to submit application." });
        }
      } catch (error) {
        console.error("Error submitting application:", error);
        res.status(500).json({ message: "Error submitting application." });
      }
    });

    app.get("/notices", async (req, res) => {
      try {
        const notices = await noticeCollection.find({}).toArray();
        res.send(notices);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch notices" });
      }
    });

    app.post("/notices", async (req, res) => {
      try {
        const { title, content, date } = req.body;

        // Create a notice object
        const notice = {
          title,
          content,
          date,
        };

        // Insert the notice into the database
        const result = await noticeCollection.insertOne(notice);

        console.log("Notice data:", notice);

        if (result.insertedCount === 1) {
          res.status(200).json({ message: "Notice created successfully" });
        } else {
          res.status(500).json({ message: "Failed to create notice" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to create notice" });
      }
    });

    // Update notice route
    app.put("/notices/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { title, content } = req.body;

        // Find the notice by ID and update its title and content
        const result = await noticeCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { title, content } }
        );

        if (result.modifiedCount === 1) {
          res.status(200).json({ message: "Notice updated successfully" });
        } else {
          res.status(404).json({ message: "Notice not found" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update notice" });
      }
    });

    // Delete notice route
    app.delete("/notices/:id", async (req, res) => {
      try {
        const { id } = req.params;

        // Delete the notice by ID
        const result = await noticeCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 1) {
          res.status(200).json({ message: "Notice deleted successfully" });
        } else {
          res.status(404).json({ message: "Notice not found" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete notice" });
      }
    });

    app.get("/results/:rollNumber", async (req, res) => {
      const { rollNumber } = req.params;

      try {
        const pdfPath = path.join(__dirname, "./assets/result.pdf"); // Replace "result.pdf" with the actual path to your PDF file

        const dataBuffer = fs.readFileSync(pdfPath);
        const pdfData = await PDFParser(dataBuffer);
        const pdfText = pdfData.text;

        const resultRegex = new RegExp(`${rollNumber} - GPA: (\\d+\\.\\d+)`);
        const failedSubjectsRegex = new RegExp(
          `${rollNumber} - Failed \\((.+)\\)`
        );

        const resultMatch = pdfText.match(resultRegex);
        const failedSubjectsMatch = pdfText.match(failedSubjectsRegex);

        if (resultMatch) {
          const result = resultMatch[1];
          res.json({ result });
        } else if (failedSubjectsMatch) {
          const failedSubjects = failedSubjectsMatch[1];
          res.json({ failedSubjects });
        } else {
          res.json({});
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to retrieve results" });
      }
    });

    // Contact form submission route
    app.post("/contact", async (req, res) => {
      const { fullName, email, phoneNumber, message } = req.body;

      try {
        // Save the contact form data to the database
        const contactData = {
          fullName,
          email,
          phoneNumber,
          message,
        };

        const result = await contactCollection.insertOne(contactData);

        if (result.insertedCount === 1) {
          // Send SMS notification using Twilio
          // client.messages
          // .create({
          //    body: 'test sms notification',
          //    from: '+12546003640',
          //    to: '+8801647470849'
          //  })
          // .then(message => console.log(message.sid))
          // .done();
          console.log("SMS Sent:", message.sid); // Debugging: Log the Twilio SMS SID
          res
            .status(200)
            .json({ message: "Contact form submitted successfully" });
        } else {
          res.status(500).json({ message: "Failed to submit contact form" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to submit contact form" });
      }
    });

    app.get("/contact", async (req, res) => {
      try {
        const contact = await contactCollection.find({}).toArray();
        res.json(contact);
      } catch (error) {
        console.error("Failed to fetch contacts", error);
        res.status(500).json({ message: "Failed to fetch contacts" });
      }
    });

    



  } catch (err) {
    console.error(err);
  } finally {
    // await client.close();
  }
}

run().catch(console.error);

app.listen(port, () => console.log(`icst running on ${port}`));

// debugging
app.use((req, res, next) => {
  console.log("Request received:", req.method, req.url);
  next();
});
