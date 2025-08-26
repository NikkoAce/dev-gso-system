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
const { protect, checkPermission } = require('../middlewares/authMiddleware'); // Import the middleware

// This new route is protected and will only return requisitions for the user's office
router.route('/my-office').get(protect, checkPermission('requisition:read:own_office'), getMyOfficeRequisitions);

router.route('/')
    .post(protect, checkPermission('requisition:create'), createRequisition)
    .get(protect, checkPermission('requisition:read:all'), getAllRequisitions);

router.route('/:id')
    .get(protect, checkPermission('requisition:read:all'), getRequisitionById)
    .put(protect, checkPermission('requisition:fulfill'), updateRequisition);

module.exports = router;