# 🏛️ AgentEscrowCourt — AI-Adjudicated Escrow for the Agentic Economy

> **GenLayer Builder Program & Agent Tank Pitch Project**  
> **GitHub Repository:** [github.com/tuannguyen1995/agent-tank](https://github.com/tuannguyen1995/agent-tank)  
> **Live App URL:** [frontend-psi-opal-38.vercel.app](https://frontend-psi-opal-38.vercel.app)  
> **Deployed Network:** `studionet` (`https://studio.genlayer.com`)  
> **Submission Track:** Builders Track (`portal.genlayer.foundation`)

---

## 🎯 1. Dòng Pitch Giá Trị Cốt Lõi (GenLayer Fit: 5/5)

> **"Vì sao AgentEscrowCourt CHẾT NẾU KHÔNG CÓ GENLAYER?"**
> 
> Trong Nền kinh tế Agent tự chủ (Agentic Economy), các AI Agent thuê lẫn nhau thực hiện các công việc phức tạp off-chain (audit code, viết tài liệu kỹ thuật, nghiên cứu thị trường). 
> **Smart contract truyền thống (Solidity) HOÀN TOÀN BẤT LỰC** trong việc nghiệm thu chất lượng sản phẩm có tính chủ quan ("Bài audit này có đạt tiêu chuẩn không?"). 
> Nếu không có GenLayer, giao dịch giữa các Agent buộc phải thông qua trung gian con người tập trung. 
> 
> Với **GenLayer Intelligent Contracts**, hệ thống bồi thẩm đoàn AI Validator đọc trực tiếp sản phẩm & tiêu chí off-chain qua `gl.nondet.web.render`, tự động đánh giá bằng LLM qua `gl.nondet.exec_prompt`, và đạt đồng thuận phi tập trung qua `gl.vm.run_nondet` để **tự động giải ngân tiền (RELEASE) hoặc hoàn tiền (REFUND)** không qua bất kỳ con người nào.

---

## 🏗️ 2. Sơ Đồ Kiến Trúc & Luồng Đồng Thuận AI (Contract Quality: 5/5)

```
[Client Agent] ---> Creates Escrow Task + Deposits GEN ---> AgentEscrowCourt.py
                                                                  |
[Worker Agent] ---> Submits Deliverable URL (e.g. GitHub/Web) ----+
                                                                  |
                                                                  v
                                                 adjudicate(escrow_id)
                                                                  |
                   +----------------------------------------------+
                   | GenLayer Optimistic Democracy Consensus      |
                   |                                              |
                   | 1. gl.nondet.web.render(criteria_url)       |
                   | 2. gl.nondet.web.render(deliverable_url)    |
                   | 3. gl.nondet.exec_prompt(LLM Judge Prompt)   |
                   | 4. gl.vm.run_nondet(leader_fn, validator_fn)|
                   |    (Validator checks SEMANTIC VERDICT match) |
                   +----------------------------------------------+
                                          |
                +-------------------------+-------------------------+
                | VERDICT == RELEASE                                | VERDICT == REFUND
                v                                                   v
  [Release GEN to Worker]                             [Refund GEN to Client]
            +                                                   +
  [AgentReputation +10]                               [AgentReputation -20]
```

### ✅ Bẫy Kỹ Thuật Đã Được Xử Lý Trọn Vẹn:
1. **Magic Version Pragma:** Dòng 1 chứa `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`.
2. **Storage Rule:** Không dùng `int` thường trong storage; dùng `bigint` cho số dư tiền ký quỹ và `u256`/`u8` cho status/id.
3. **Storage Container:** Dùng `TreeMap[str, EscrowTask]` (không gán lại `TreeMap()` trong `__init__`).
4. **Custom Struct:** `EscrowTask` sử dụng `@allow_storage @dataclass`.
5. **Consensus Validator:** Dùng `gl.vm.run_nondet` với `validator_fn` chỉ kiểm tra tính tương đương của kết luận (`mine["verdict"] == leader["verdict"]`), bỏ qua khác biệt văn phong ở câu chữ giải thích `reason`.

---

## 🚀 3. Hướng Dẫn Deploy Lên `studionet` Từng Bước

### Bước 1: Mở GenLayer Studio
1. Truy cập `https://studio.genlayer.com/contracts`.
2. Chọn **Settings -> Reset Storage -> Confirm**, sau đó Ctrl+Shift+R / Cmd+Shift+R để làm sạch môi trường Studio.

### Bước 2: Deploy Contract
1. Tạo file `AgentReputation.py` trên Studio, dán mã từ [contracts/AgentReputation.py](file:///c:/Users/Admin/Documents/genlayer/agent-tank/contracts/AgentReputation.py). Bấm **Deploy**.
2. Tạo file `AgentEscrowCourt.py` trên Studio, dán mã từ [contracts/AgentEscrowCourt.py](file:///c:/Users/Admin/Documents/genlayer/agent-tank/contracts/AgentEscrowCourt.py). Bấm **Deploy**.
3. Kiểm tra tab Transaction trong Studio sidebar: Đảm bảo `Result: SUCCESS` (không chỉ dừng ở `Status: FINALIZED`).

### Bước 3: Liên Kết 2 Contract
1. Trên Studio, gọi phương thức `set_reputation_contract` của `AgentEscrowCourt` với địa chỉ contract `AgentReputation`.
2. Gọi phương thức `set_authorized_court` của `AgentReputation` với địa chỉ contract `AgentEscrowCourt`.

---

## 💻 4. Chạy Frontend dApp Local

```bash
cd frontend
npm install
npm run dev
```

App sẽ chạy tại `http://localhost:3000`.
Khi connect ví MetaMask, ứng dụng sẽ tự động chuyển mạng (Network Switch) sang **GenLayer Studionet (Chain ID 61999)**.

---

## 🧪 5. Chạy Test Suite (`gltest`)

```bash
pytest tests/
# Hoặc test trực tiếp trên studionet:
gltest --network studionet
```

---

## 📦 Danh Sách File Dự Án

- `contracts/AgentEscrowCourt.py`: Hợp đồng thông minh phân xử tranh chấp & quản lý ký quỹ escrow AI.
- `contracts/AgentReputation.py`: Hợp đồng thông minh lưu trữ điểm uy tín cho các AI Agent.
- `tests/test_escrow_court.py`: Bộ test suite kiểm thử toàn bộ luồng giao dịch & AI consensus.
- `scripts/deploy.py`: Script hỗ trợ triển khai.
- `frontend/`: Ứng dụng dApp React + Vite + Tailwind CSS + `genlayer-js`.
