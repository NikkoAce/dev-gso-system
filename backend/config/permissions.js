// A centralized object for all system permissions to prevent typos and ensure consistency.
const PERMISSIONS = Object.freeze({
    // Dashboard
    DASHBOARD_VIEW: 'dashboard:view',
    // Movable Assets
    ASSET_CREATE: 'asset:create',
    ASSET_READ: 'asset:read',
    ASSET_READ_OWN_OFFICE: 'asset:read:own_office',
    ASSET_UPDATE: 'asset:update',
    ASSET_DELETE: 'asset:delete',
    ASSET_EXPORT: 'asset:export',
    ASSET_TRANSFER: 'asset:transfer',
    // Immovable Assets
    IMMOVABLE_CREATE: 'immovable:create',
    IMMOVABLE_READ: 'immovable:read',
    IMMOVABLE_UPDATE: 'immovable:update',
    IMMOVABLE_DELETE: 'immovable:delete',
    // Slips
    SLIP_GENERATE: 'slip:generate',
    SLIP_READ: 'slip:read',
    SLIP_MANAGE: 'slip:manage',
    // Supplies & Requisitions
    STOCK_READ: 'stock:read',
    STOCK_MANAGE: 'stock:manage',
    REQUISITION_CREATE: 'requisition:create',
    REQUISITION_READ_OWN_OFFICE: 'requisition:read:own_office',
    REQUISITION_READ_ALL: 'requisition:read:all',
    REQUISITION_FULFILL: 'requisition:fulfill',
    // Admin & Settings
    REPORT_GENERATE: 'report:generate',
    SETTINGS_READ: 'settings:read',
    SETTINGS_MANAGE: 'settings:manage',
    USER_READ: 'user:read',
    USER_MANAGE: 'user:manage',
    ADMIN_DATA_READ: 'admin:data:read',
    ADMIN_DATA_MIGRATE: 'admin:data:migrate',
    ADMIN_DATABASE_EXPORT: 'admin:database:export',
});

module.exports = PERMISSIONS;