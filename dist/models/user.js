"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
class User {
    constructor(username, email, password, full_name, phone, role = "MEMBER", id, createdAt = new Date(), updatedAt) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.password = password;
        this.phone = phone;
        this.full_name = full_name;
        this.role = role;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt ?? null;
    }
}
exports.User = User;
