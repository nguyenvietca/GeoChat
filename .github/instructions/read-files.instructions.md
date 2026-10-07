---
applyTo: "**"
description: Quy tắc đọc file
---
# Quy tắc đọc file

- Luôn đọc file bắt đầu từ dòng 1 (startLine = 1), không bắt đầu giữa chừng.
- Ưu tiên đọc một khoảng lớn (toàn bộ file nếu hợp lý) thay vì nhiều lần đọc nhỏ.
- Nếu file dài và chưa đọc hết, đọc tiếp các đoạn sau cho đến khi đủ ngữ cảnh.
- Với file prompt trong `AI_promt/`, đọc từ dòng 1 đến hết trước khi thực hiện.
- JAVA_HOME đã được cấu hình trong `.vscode/settings.json`; không cần set lại mỗi session.
