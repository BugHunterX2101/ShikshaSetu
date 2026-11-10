# ShikshaSetu (शिक्षासेतु) — Fee Tracking System & Parent Portal

**Repository**: [https://github.com/BugHunterX2101/ShikshaSetu](https://github.com/BugHunterX2101/ShikshaSetu)  
**Client / Context**: Company A, Jaipur (4 Centres: Vaishali Nagar, Gopalpura, Tonk Road, Vidhyadhar Nagar | 2,600 Active Students)  
**Anchor Operational Date**: `2026-11-02`  
**License**: Proprietary / Client Confidential  

---

## 📌 Executive Overview

**ShikshaSetu** is a production-grade, statutory-compliant fee tracking engine, collection terminal, and parent communication portal built for coaching institutes in Rajasthan under the **Rajasthan Coaching Institutes (Control & Regulation) Act 2025**, **DPDP Act 2023 / Rules 2025**, **GST SAC 999293 (18%)**, and **Income Tax Act Section 269ST**.

It replaces paper ledgers and fragmented records with a real-time, audit-proof single source of truth across all 4 Jaipur branches.

---

## 🌟 Core Highlights & Architectural Guarantees

1. **Deterministic Financial Math & Statutory Compliance**:
   - **Rajasthan Coaching Act 2025 §6(2)(d)**: Mandates $\ge 4$ equal instalments for all long-term batches (e.g. NEET 4 $\times$ ₹30,000).
   - **GST SAC 999293 Reverse-Split**: Exact round-half-up integer arithmetic without float drift:
     $$\text{Tax} = \left\lfloor \frac{18 \times \text{Gross} + 118}{236} \right\rfloor, \quad \text{Base} = \text{Gross} - \text{Tax}$$
   - **Income Tax Act §269ST**: Strict ₹2,00,000 single-day aggregate cash limit enforcement with automatic rejection and digital payment routing.
   - **Gapless Sequential Receipts**: Audit-proof receipts (`RCP/26-27/000001` .. `RCP/26-27/xxxxxx`) secured by Postgres transaction row locks.
   - **MoE 2024 / Rajasthan 2025 Pro-Rata Refunds**: 10-day statutory turnaround covering Cases A through F with automatic non-refundable registration cap (₹2,500).

2. **Deterministic Early Warning Dropout Predictor**:
   - Multi-factor risk composite: Overdue days (32 pts) + Attendance drop (28 pts) + Test dip (19 pts) = **79/100** for student `STU-0587` (Rohan Sharma, NEET dropper).
   - Generates automated intervention tickets for academic counselors and centre managers before physical dropouts occur.

3. **Privacy & DPDP Act 2023 / Rules 2025 Compliance**:
   - **Rule 10 Adult KYC**: Explicit guardian age verification code (`5870`) before processing minor consent.
   - **Instant Consent Withdrawal**: Parent-side opt-out instantly suppresses all marketing/reminder communications while preserving statutory financial records.

4. **Bilingual 7-Screen User Experience**:
   - English & Hindi (`en` / `hi`) seamless toggle across all 7 core operational interfaces.
   - **5-Second Mobile Rule**: Large font dues card, colour-coded urgency badges, and one-tap UPI pay for busy parents on 360px mobile viewports.
   - Zero dead buttons: every action, filter, modal, download, and receipt trigger is fully wired to live state.

---

## 📂 Core Documentation

- **Technical Design Document**: [`Technical Design Document ShikshaSetu Fee Tracking System and Parent Portal.md`](./Technical%20Design%20Document%20ShikshaSetu%20Fee%20Tracking%20System%20and%20Parent%20Portal.md)
- **Technical Architecture Document**: [`shikshasetu-technical-architecture.md`](./shikshasetu-technical-architecture.md)
- **Product Requirement Document (PRD)**: [`PRD — Fee Tracking System & Parent Portal (working title ShikshaSetu).md`](./PRD%20—%20Fee%20Tracking%20System%20%26%20Parent%20Portal%20(working%20title%20ShikshaSetu).md)
- **Verification & Test Suite Audit**: [`TEST_READY.md`](./TEST_READY.md)

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) + React 19 + TypeScript
- **Styling**: Tailwind CSS + Lucide Icons + Responsive 360px Mobile-First Layouts
- **Validation**: Zod schema validation on all inputs and API routes
- **Testing**: [Vitest](https://vitest.dev/) (518 automated tests across 36 test files, covering TC-01 to TC-23, edge cases, and adversarial scenarios)
- **Database Architecture**: PostgreSQL schema with atomic sequences, foreign keys, and audit logs

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm (or npm / yarn)

### Installation
```bash
# Clone the repository
git clone https://github.com/BugHunterX2101/ShikshaSetu.git
cd ShikshaSetu

# Install dependencies
pnpm install
```

### Running the Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Automated Tests
```bash
# Run all 518 Vitest test suites
pnpm test

# Run tests in watch mode
pnpm test:watch

# Check TypeScript types
pnpm typecheck
```

### Building for Production
```bash
pnpm build
pnpm start
```

---

## 🧪 Test Suite Summary

- **Total Test Files**: 36
- **Total Tests Passing**: 518 / 518 (100% pass rate)
- **Coverage Highlights**:
  - Test Cases `TC-01` through `TC-23`
  - Statutory Instalment & Rajasthan Coaching Act Rules
  - GST SAC 999293 Integer Reverse-Split Validation
  - §269ST ₹2,00,000 Cash Transaction Hard Locks
  - Sequential Receipt Generator & Row Lock Concurrency
  - MoE 2024 / Rajasthan 2025 Pro-Rata Refund Matrix
  - Rohan Sharma (`STU-0587`) Dropout Risk Score Assertion (`32 + 28 + 19 = 79`)
  - DPDP Act Guardian KYC & Consent Revocation State Machine
  - 7 Screen Bilingual UI Components & Viewport Adaptability

---

Developed with ❤️ for Company A, Jaipur.
