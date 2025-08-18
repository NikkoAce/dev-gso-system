// FILE: backend/routes/requisitionRoutes.js
const express = require('express');
const router = express.Router();
const {
    createRequisition,
    getAllRequisitions,
    getRequisitionById,
    updateRequisition,
    getMyOfficeRequisitions // Import the new controller
} = require('../controllers/requisitionController');
const { protect } = require('../middlewares/authMiddleware'); // Import the middleware

// This new route is protected and will only return requisitions for the user's office
router.route('/my-office').get(protect, getMyOfficeRequisitions);

router.route('/')
    .post(protect, createRequisition)
    .get(protect, getAllRequisitions);

router.route('/:id')
    .get(protect, getRequisitionById)
    .put(protect, updateRequisition);

module.exports = router;