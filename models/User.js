const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    hasVoted: { type: Boolean, default: false }, // Tracks voting status
});

const User = mongoose.model('User', userSchema);

module.exports = User;
