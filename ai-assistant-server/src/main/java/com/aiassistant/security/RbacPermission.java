package com.aiassistant.security;

/** Permissions for RBAC-based access control of assistant operations. */
public enum RbacPermission {
    CHAT,
    TRANSLATE,
    SUMMARIZE,
    STREAM,
    EXPORT,
    ADMIN,
    CAPABILITY_INVOKE,
    TEMPLATE_MANAGE,
    FILE_UPLOAD
}
