const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const PAR = require('../models/PAR');
const ICS = require('../models/ICS');
const Employee = require('../models/Employee');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

const migrateCustodians = async () => {
    await connectDB();

    console.log('Starting custodian data migration...');

    try {
        // --- Fetch all employees to create a lookup map ---
        const employees = await Employee.find({}).lean();
        const employeeMap = new Map(employees.map(emp => [emp.name, emp]));
        console.log(`Loaded ${employeeMap.size} employees into memory.`);

        // --- Migrate PAR slips ---
        const parsToMigrate = await PAR.find({ 'custodian.name': { $exists: false } }).lean();
        console.log(`Found ${parsToMigrate.length} PAR slips to migrate.`);
        let parUpdatedCount = 0;

        for (const par of parsToMigrate) {
            const custodianName = par.custodian; // This is the old string value
            if (typeof custodianName !== 'string') continue;

            const employeeDetails = employeeMap.get(custodianName);
            if (employeeDetails) {
                const newCustodianObject = {
                    name: employeeDetails.name,
                    designation: employeeDetails.designation,
                    office: 'Unknown' // Office is not on the Employee model, set a default
                };
                await PAR.updateOne({ _id: par._id }, { $set: { custodian: newCustodianObject } });
                parUpdatedCount++;
            } else {
                console.warn(`  - WARNING: Could not find employee details for "${custodianName}" in PAR #${par.parNumber}. Skipping.`);
            }
        }
        console.log(`Successfully updated ${parUpdatedCount} PAR slips.`);

        // --- Migrate ICS slips ---
        const icsToMigrate = await ICS.find({ 'custodian.name': { $exists: false } }).lean();
        console.log(`Found ${icsToMigrate.length} ICS slips to migrate.`);
        let icsUpdatedCount = 0;

        for (const ics of icsToMigrate) {
            const custodianName = ics.custodian; // This is the old string value
            if (typeof custodianName !== 'string') continue;

            const employeeDetails = employeeMap.get(custodianName);
            if (employeeDetails) {
                const newCustodianObject = {
                    name: employeeDetails.name,
                    designation: employeeDetails.designation,
                    office: 'Unknown' // Office is not on the Employee model, set a default
                };
                await ICS.updateOne({ _id: ics._id }, { $set: { custodian: newCustodianObject } });
                icsUpdatedCount++;
            } else {
                console.warn(`  - WARNING: Could not find employee details for "${custodianName}" in ICS #${ics.icsNumber}. Skipping.`);
            }
        }
        console.log(`Successfully updated ${icsUpdatedCount} ICS slips.`);

    } catch (error) {
        console.error('An error occurred during migration:', error);
    } finally {
        console.log('Migration process finished.');
        mongoose.disconnect();
    }
};

migrateCustodians();