export type UserRole = "GUEST" | "MEMBER" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE";

export class User {
  id?: number;
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt?: Date | null;

  constructor(
    username: string,
    email: string,
    password: string,
    full_name: string,
    role: UserRole = "MEMBER",
    status: UserStatus = "ACTIVE",
    id?: number,
    createdAt: Date = new Date(),
    updatedAt?: Date | null
  ) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.password = password;
    this.full_name = full_name;
    this.role = role;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt ?? null;
  }
}
