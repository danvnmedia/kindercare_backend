# KinderCare CLI - Admin Management

Simple CLI tool để quản lý admin accounts cho KinderCare Backend.

Các lệnh npm trong tài liệu này tự tải file `.env` ở thư mục gốc. `DATABASE_URL` phải là connection string PostgreSQL hoàn chỉnh; biến môi trường đã được export hoặc inject vào container luôn được ưu tiên hơn giá trị trong file.

## 🚀 Quick Start

### Tạo Admin Account

```bash
# Cách 1: Tạo admin tự động (Tự động tạo user trên Clerk) ⭐ Khuyến nghị
npm run cli:create-admin -- --email=admin@kindercare.com --name="Admin Name"

# Cách 2: Tạo admin với phone number (Tự động tạo trên Clerk)
npm run cli:create-admin -- \
  --email=admin@kindercare.com \
  --name="John Doe" \
  --phone="+84901234567"

# Cách 3: Tạo admin với Clerk UID có sẵn (Nếu user đã tồn tại trên Clerk)
npm run cli:create-admin -- \
  --email=admin@kindercare.com \
  --name="John Doe" \
  --clerk-uid=user_abc123xyz \
  --phone="+84901234567"
```

### Xem Danh Sách Admin

```bash
npm run cli:list-admins
```

### Xóa Admin Account

```bash
npm run cli:delete-admin -- --clerk-uid=user_abc123xyz
```

### Đổi Password Admin Trên Clerk

```bash
read -s NEW_PASSWORD
printf '%s' "$NEW_PASSWORD" | npm run cli:update-admin-password -- \
  --email=admin@kindercare.com \
  --password-stdin
unset NEW_PASSWORD

# Hoặc dùng Clerk UID trực tiếp
read -s NEW_PASSWORD
printf '%s' "$NEW_PASSWORD" | npm run cli:update-admin-password -- \
  --clerk-uid=user_abc123xyz \
  --password-stdin
unset NEW_PASSWORD
```

### Đổi Password Bất Kỳ Clerk Account

```bash
read -s NEW_PASSWORD
printf '%s' "$NEW_PASSWORD" | npm run cli:update-clerk-password -- \
  --email=user@example.com \
  --password-stdin
unset NEW_PASSWORD

# Hoặc dùng Clerk UID trực tiếp
read -s NEW_PASSWORD
printf '%s' "$NEW_PASSWORD" | npm run cli:update-clerk-password -- \
  --clerk-uid=user_abc123xyz \
  --password-stdin
unset NEW_PASSWORD
```

## 📋 Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `cli:create-admin` | Tạo admin account mới | `npm run cli:create-admin -- --email=... --name=...` |
| `cli:list-admins` | Liệt kê tất cả admin | `npm run cli:list-admins` |
| `cli:delete-admin` | Xóa admin account | `npm run cli:delete-admin -- --clerk-uid=...` |
| `cli:update-admin-password` | Đổi password admin trên Clerk | `... \| npm run cli:update-admin-password -- --email=... --password-stdin` |
| `cli:update-clerk-password` | Đổi password bất kỳ user trên Clerk | `... \| npm run cli:update-clerk-password -- --email=... --password-stdin` |

## ⚙️ Options

### Create Admin Options

| Option | Required | Description | Example |
|--------|----------|-------------|---------|
| `--email` | ✅ Yes | Email của admin | `--email=admin@test.com` |
| `--name` | ✅ Yes | Tên đầy đủ | `--name="Nguyễn Văn A"` |
| `--clerk-uid` | ❌ No | Clerk User ID (nếu user đã có trên Clerk) | `--clerk-uid=user_abc123` |
| `--phone` | ❌ No | Số điện thoại (E.164 format) | `--phone="+84901234567"` |
| `--password-stdin` | ❌ No | Đọc password tạo user Clerk từ stdin | `--password-stdin` |

### Update Password Options

| Option | Required | Description | Example |
|--------|----------|-------------|---------|
| `--email` | ✅ Yes* | Email admin trên Clerk | `--email=admin@test.com` |
| `--clerk-uid` | ✅ Yes* | Clerk User ID | `--clerk-uid=user_abc123` |
| `--password-stdin` | ✅ Yes | Đọc password mới từ stdin | `--password-stdin` |

*Cần một trong hai: `--email` hoặc `--clerk-uid`.

### Update Clerk Password Options

| Option | Required | Description | Example |
|--------|----------|-------------|---------|
| `--email` | ✅ Yes* | Email user trên Clerk | `--email=user@test.com` |
| `--clerk-uid` | ✅ Yes* | Clerk User ID | `--clerk-uid=user_abc123` |
| `--password-stdin` | ✅ Yes | Đọc password mới từ stdin | `--password-stdin` |

*Cần một trong hai: `--email` hoặc `--clerk-uid`.

**🎉 Smart Feature:**
- Nếu **không** cung cấp `--clerk-uid`, CLI sẽ **tự động tạo user trên Clerk**
- Nếu email đã tồn tại trên Clerk, CLI sẽ sử dụng Clerk UID có sẵn
- User có thể login ngay bằng email (Clerk sẽ gửi magic link)

## 🎯 Use Cases

### Development Environment

```bash
# Tạo admin để test local
npm run cli:create-admin -- \
  --email=dev@test.com \
  --name="Dev Admin"

# Xem danh sách admin hiện có
npm run cli:list-admins

# Xóa admin test khi không cần
npm run cli:delete-admin -- --clerk-uid=user_xxx_from_list_admins

# Đổi password admin test mà không đưa secret vào argv/history
read -s NEW_PASSWORD
printf '%s' "$NEW_PASSWORD" | npm run cli:update-admin-password -- --email=dev@test.com --password-stdin
unset NEW_PASSWORD

# Đổi password một Clerk user bất kỳ
read -s NEW_PASSWORD
printf '%s' "$NEW_PASSWORD" | npm run cli:update-clerk-password -- --email=parent@test.com --password-stdin
unset NEW_PASSWORD
```

### Staging/Production Environment

```bash
# SSH vào server
ssh user@production-server

# Tạo admin với Clerk UID thật (lấy từ Clerk Dashboard)
npm run cli:create-admin -- \
  --email=admin@kindercare.com \
  --name="Production Admin" \
  --clerk-uid=user_2abc123xyz \
  --phone="+84901234567"
```

## 📝 Examples

### Example 1: Tạo Admin Tự Động (Khuyến nghị) ⭐

```bash
npm run cli:create-admin -- --email=admin@local.dev --name="Local Admin"
```

**Output:**
```
🚀 Creating admin account...
📝 No Clerk UID provided, creating user on Clerk automatically...
🔐 Creating user on Clerk...
✅ User created on Clerk with UID: user_2abc123xyz456
📝 Creating ADMIN role...
✅ ADMIN role created
💾 Saving admin user to database...

✅ Admin account created successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email:       admin@local.dev
👤 Full Name:   Local Admin
🆔 User ID:     1
🔑 Clerk UID:   user_2abc123xyz456
📱 Phone:       N/A
🎭 Roles:       ADMIN
✨ Status:      Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Note: User was automatically created on Clerk.
   The user can now login using their email.
```

### Example 2: Tạo Admin Với Đầy Đủ Thông Tin

```bash
npm run cli:create-admin -- \
  --email=admin@kindercare.com \
  --name="Nguyễn Văn Admin" \
  --clerk-uid=user_2NNEqL2nrIRdJ194ndJqAHtrZm5 \
  --phone="+84901234567"
```

### Example 3: Kiểm Tra Admin Accounts

```bash
npm run cli:list-admins
```

**Output:**
```
📋 Listing all admin accounts...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Nguyễn Văn Admin
   📧 Email:     admin@kindercare.com
   🆔 ID:        1
   🔑 Clerk UID: user_2NNEqL2nrIRdJ194ndJqAHtrZm5
   ✨ Status:    ✅ Active

2. Local Admin
   📧 Email:     admin@local.dev
   🆔 ID:        2
   🔑 Clerk UID: clerk_1731654321000
   ✨ Status:    ✅ Active

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔧 How It Works

1. **Check Existing User**: Kiểm tra email đã tồn tại trong database chưa
2. **Clerk Integration**:
   - Nếu có `--clerk-uid`: Sử dụng UID được cung cấp
   - Nếu không có `--clerk-uid`: **Tự động tạo user trên Clerk** với email
   - Nếu email đã có trên Clerk: Lấy Clerk UID có sẵn (không tạo duplicate)
3. **Create ADMIN Role**: Tự động tạo ADMIN role nếu chưa tồn tại
4. **Create User in Database**: Lưu user vào database với Clerk UID
5. **Assign Role**: Gán ADMIN role cho user vừa tạo
6. **Success**: User có thể login ngay qua Clerk authentication

## 🛡️ Security

- **Direct Database Access**: CLI chạy trực tiếp, không qua HTTP
- **Server Access Required**: Chỉ chạy được khi có quyền access server
- **No API Exposure**: Không có endpoint nào expose chức năng này
- **Audit Trail**: Mọi hành động được log rõ ràng

## ❓ Troubleshooting

### Error: "User with email ... already exists"

**Giải pháp:**
```bash
# Kiểm tra danh sách admin hiện có
npm run cli:list-admins

# Nếu muốn xóa và tạo lại, lấy Clerk UID từ cli:list-admins trước
npm run cli:delete-admin -- --clerk-uid=user_xxx_from_list_admins
npm run cli:create-admin -- --email=admin@example.com --name="New Admin"
```

### Error: "Database connection failed"

**Giải pháp:**
1. Kiểm tra `.env` file có `DATABASE_URL` đúng không
2. Kiểm tra database có đang chạy không
3. Chạy migrations: `npm run prisma:migrate:deploy`

### Error: "Prisma Client not generated"

**Giải pháp:**
```bash
npm run prisma:generate
```

## 🚀 Deployment Workflow

### Development
```bash
# 1. Setup database
npm run prisma:migrate:dev

# 2. Tạo admin
npm run cli:create-admin -- --email=dev@test.com --name="Dev Admin"

# 3. Start dev server
npm run start:dev
```

### Production
```bash
# 1. Deploy code
git push production main

# 2. SSH vào server
ssh user@production-server

# 3. Run migrations
npm run prisma:migrate:deploy

# 4. Tạo admin
npm run cli:create-admin -- \
  --email=admin@kindercare.com \
  --name="Production Admin" \
  --clerk-uid=user_xxx_from_clerk

# 5. Start app
npm run start:prod
```

## 📚 Related Documentation

- [Project CLAUDE.md](../../CLAUDE.md) - Project development guide
- [Prisma Schema](../../prisma/schema.prisma) - Database schema
- [User Management Use Cases](../application/user-management/use-cases/) - Business logic

---

**Maintained By:** [DHA Enterprise](https://github.com/DHA-Enterprise)
**Last Updated:** 2026-07-13
