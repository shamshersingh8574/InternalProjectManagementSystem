const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Auto-migrate legacy task status values from 'in_progress' to 'in-progress'
    const Task = require('../models/Task');
    const result = await Task.updateMany({ status: 'in_progress' }, { status: 'in-progress' });
    if (result.modifiedCount > 0) {
      console.log(`Migrated ${result.modifiedCount} legacy tasks status to 'in-progress'`);
    }
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
