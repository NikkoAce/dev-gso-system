// FILE: backend/routes/requisitionRoutes.js
const express = require('express');
const router = express.Router();
const {
    createRequisition,
    getAllRequisitions,
    getRequisitionById,
    updateRequisition,
    getMyOfficeRequisitions,
    getMyOfficeRequisitionById,
    markRequisitionAsReceived
} = require('../controllers/requisitionController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions.js');

// This new route is protected and will only return requisitions for the user's office
router.route('/my-office').get(protect, checkPermission(PERMISSIONS.REQUISITION_READ_OWN_OFFICE), getMyOfficeRequisitions);

// This new route is for fetching a single requisition belonging to the user's office.
router.route('/my-office/:id').get(protect, checkPermission(PERMISSIONS.REQUISITION_READ_OWN_OFFICE), getMyOfficeRequisitionById);

// NEW: Route for an end-user to mark a requisition as received.
router.route('/my-office/:id/receive').put(protect, checkPermission(PERMISSIONS.REQUISITION_READ_OWN_OFFICE), markRequisitionAsReceived);

router.route('/')
    .post(protect, checkPermission(PERMISSIONS.REQUISITION_CREATE), createRequisition)
    .get(protect, checkPermission(PERMISSIONS.REQUISITION_READ_ALL), getAllRequisitions);

router.route('/:id')
    .get(protect, checkPermission(PERMISSIONS.REQUISITION_READ_ALL), getRequisitionById)
    .put(protect, checkPermission(PERMISSIONS.REQUISITION_FULFILL), updateRequisition);

module.exports = router;