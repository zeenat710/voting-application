const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const mongostore= require('connect-mongo');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Models
const Candidate = require('./models/Candidate');
const User = require('./models/User');  // Import User model
const Voter = require('./models/Vote'); // This was missing in your code
const VotingStatus= require("./models/Votingstatus")
// Global voting state
let votingActive = false;

const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(flash());


// Database Connection
// mongoose.connect('mongodb://localhost:27017/voting-system', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// })
//     .then(() => console.log('Connected to MongoDB'))
//     .catch(err => console.error('MongoDB connection error:', err));


const dburl = process.env.ATLAS_URL || process.env.MONGO_URI; // Use the correct variable

if (!dburl) {
    console.error("Error: MongoDB URI is undefined. Please check your .env file.");
    process.exit(1); // Exit the process to prevent further errors
}

async function main() {
    try {
        await mongoose.connect(dburl, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to Database & connection successful");
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1); // Exit if connection fails
    }
}

main();


// Models (Ensure these schemas exist in the `models` folder)
// Candidate Schema


function requireAuth(req, res, next) {
    if (!req.session.userId) {
        req.flash('message', 'Please log in first.');
        return res.redirect('/login');
    }
    next();
}


// Registration Page
app.get('/register', (req, res) => {
    res.render('register', { message: req.flash('message') });
});

// Register User
app.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        req.flash('message', 'User with this email already exists!');
        return res.redirect('/register');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashedPassword, phone });
    await newUser.save();
    req.flash('message', 'Registration successful! You can now log in.');
    res.redirect('/login');
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('message') });
});

// Login User
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        req.flash('message', 'User not found!');
        return res.redirect('/login');
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
        req.flash('message', 'Incorrect password!');
        return res.redirect('/login');
    }

    req.session.userId = user._id; // Store user ID in session
    req.flash('message', 'Login successful!');
    res.redirect('/');
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


// Home Route
app.get('/', (req, res) => {
    res.render('index', { message: req.flash('message') });
});

// Admin Dashboard
// Fetching users who have registered but haven't voted
app.get('/admin', async (req, res) => {
    try {
        // Fetch all users who haven't voted
        const notVoted = await User.find()  // Fetch all users
            .populate('voter')  // Assuming Voter model has a reference to the User model
            .where('voter.hasVoted').equals(false);  // Filter out users who haven't voted yet

        // Fetch candidates and other necessary data
        const candidates = await Candidate.find();

        // Check voting status (you can modify this part depending on your voting status logic)
        const votingStatus = await VotingStatus.findOne({});
        const votingActive = votingStatus ? votingStatus.isActive : false;

        res.render('admin', { candidates, notVoted, votingActive, message: req.flash('message') });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
});


// Add Candidate
app.post('/admin/add-candidate', async (req, res) => {
    const { name, position, symbol, party } = req.body;
    await Candidate.create({ name, position, symbol, party });
    req.flash('message', 'Candidate added successfully!');
    res.redirect('/admin');
});

// Remove Candidate
app.post('/admin/remove-candidate/:id', async (req, res) => {
    await Candidate.findByIdAndDelete(req.params.id);
    req.flash('message', 'Candidate removed successfully!');
    res.redirect('/admin');
});

// Start Voting
app.post('/admin/start-voting', (req, res) => {
    votingActive = true;
    req.flash('message', 'Voting started!');
    res.redirect('/admin');
});

// Stop Voting
app.post('/admin/stop-voting', (req, res) => {
    votingActive = false;
    req.flash('message', 'Voting stopped!');
    res.redirect('/admin');
});

// Show Results Route
app.get('/admin/show-results', async (req, res) => {
    try {
        // Fetch all candidates and their vote counts
        const candidates = await Candidate.find();
        
        // Sort candidates by votes in descending order
        candidates.sort((a, b) => b.votes - a.votes);

        let winner = null;
        if (candidates.length > 0) {
            winner = candidates[0];
        }

        res.render('result', { candidates, winner, votingActive });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).send('Error fetching results');
    }
});


// User Voting Page
// User Voting Page
app.get('/vote', async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        req.flash('message', 'Please log in to vote!');
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            req.flash('message', 'User not found. Please register first.');
            return res.redirect('/register');
        }

        const candidates = await Candidate.find();

        res.render('voting', {
            candidates,
            hasVoted: user.hasVoted,
            votingActive,
            message: req.flash('message')
        });
    } catch (err) {
        console.error('Error fetching voting data:', err);
        req.flash('message', 'Error fetching voting data.');
        res.redirect('/');
    }
});



// Submit Vote
// Submit Vote
app.post('/vote', async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        req.flash('message', 'Please log in to vote!');
        return res.redirect('/login');
    }

    if (!votingActive) {
        req.flash('message', 'Voting is not active at the moment.');
        return res.redirect('/vote');
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            req.flash('message', 'User not found. Please register first.');
            return res.redirect('/register');
        }

        if (user.hasVoted) {
            req.flash('message', 'You have already voted!');
            return res.redirect('/vote');
        }

        const candidateId = req.body.candidateId;
        if (!candidateId) {
            req.flash('message', 'No candidate selected!');
            return res.redirect('/vote');
        }

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            req.flash('message', 'Invalid candidate selected!');
            return res.redirect('/vote');
        }

        // Increment candidate's votes
        candidate.votes += 1;
        await candidate.save();

        // Mark user as voted
        user.hasVoted = true;
        await user.save();

        req.flash('message', 'Vote submitted successfully! Thank you for voting.');
        res.redirect('/vote');
    } catch (err) {
        console.error('Error processing vote:', err);
        req.flash('message', 'Error processing your vote. Please try again.');
        res.redirect('/vote');
    }
});



// Seed Voter Data (Optional: For Testing)
app.get('/seed', async (req, res) => {
    await Voter.deleteMany(); // Clear existing data
    await Voter.insertMany([
        { name: 'John Doe', email: 'john@example.com', phone: '1234567890', hasVoted: false },
        { name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321', hasVoted: false },
    ]);
    res.send('Voters seeded!');
});

// Server Start
app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
