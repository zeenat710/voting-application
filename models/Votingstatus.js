const mongoose = require('mongoose');

const votingStatusSchema = new mongoose.Schema({
    isActive: { type: Boolean, required: true, default: false },
    // You can add other fields if needed (e.g., a timestamp for when voting started or ended)
});

const VotingStatus = mongoose.model('VotingStatus', votingStatusSchema);
module.exports = VotingStatus;
