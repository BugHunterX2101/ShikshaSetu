# ShikshaSetu Fee Tracking System & Parent Portal: Technical Architecture Document

**GitHub Repository**: [https://github.com/BugHunterX2101/ShikshaSetu](https://github.com/BugHunterX2101/ShikshaSetu)

## 1. Executive Summary and Commercial Context

### 1.1 System Identity and Scope
ShikshaSetu is an enterprise-grade automated fee tracking system, bilingual mobile parent portal, and statutory compliance platform designed for private coaching institutes operating multi-centre operations in India. The reference deployment specifies Company A, a Jaipur-based entrance coaching institute managing four operational centres (**Gopalpura Bypass (Main Centre)**, **Vaishali Nagar**, **Mansarovar**, and **Sikar Road**), enrolling **2,600 active students** in JEE and NEET entrance programs, and employing **140 staff members**.

The platform unifies financial ledger management, automated payment reminder orchestration, statutory pro-rata refund calculations, parent communication, and explainable AI-driven student retention scoring within a single modular software architecture.

| Core Deliverable / Module | Functional Scope & Target Persona | Implementation Boundary |
| :--- | :--- | :--- |
| **Bilingual Mobile Parent Portal** | Mobile-first web application (360×800px viewport) optimized for low-end devices. Provides a 5-second dues view (Amount Due, Due Date, Pay Button above the fold), 18% GST receipts, attendance, and test performance. | Parent / Guardian persona. Uses OTP authentication linked to adult guardian records. |
| **Multi-Centre Accounts Workspace** | Centralized dashboard for Accounts Executives across all four Jaipur centres. Provides unified fee ledgers, ageing bucket analysis, unmatched bank transfer queue, CSV metric imports, and Tally Prime XML/CSV exports. | Accounts Executive & Founder-Director roles. Strict centre-scoped data access. |
| **Bilingual Reminder Engine** | Scheduled messaging state machine executing automated reminders across T-7, T-0, T+3, T+7, and T+15 relative to instalment due dates in English and Hindi. | Integrates atomically with the payment transaction to auto-suppress reminders upon payment. |
| **Statutory Pro-Rata Refund Engine** | Automated exit workflow enforcing daily pro-rata fee consumption math across tuition, hostel, and mess fee heads with a mandatory 10-calendar-day settlement SLA countdown. | Segregation-of-duties workflow: Accounts raises, Director approves, Accounts settles. |
| **Explainable AI Dropout-Risk Engine** | Two-stage hybrid risk scanner generating 0–100 composite risk scores from fee delinquency, attendance drop, and test trajectory metrics. | Read-only analytics boundary. Creates counsellor call tasks (`OPEN_CALL_TASK`); never alters fees or contacts parents. |

---

### 1.2 Forensic Financial Math and ROI Baseline
A forensic audit of Company A’s annual financial baseline demonstrates the commercial necessity for automated fee management:

*   **Total Annual Billing**: Across 2,600 enrolled students paying an average annual course fee of ₹1,20,000 (paid in 3 or 4 instalments), annual billed revenue totals $2,600 \times \text{₹}1,20,000 = \text{₹}31,20,00,000$ (**₹31.20 Crore/year**).
*   **Uncollected Fee Leakage (2% of Billed Revenue)**: Due to fragmented Excel-based tracking across separate centre spreadsheets and delayed manual telephone follow-ups, 2% of total billed revenue is lost permanently: $0.02 \times \text{₹}31.20\text{ Crore} = \text{₹}62.40\text{ Lakh/year}$.
*   **Severe Delinquency Drag (>60 Days Overdue)**: Exactly 12% of total instalment value ($0.12 \times \text{₹}31.20\text{ Crore} = \text{₹}3.744\text{ Crore/year}$) arrives more than 60 days past its scheduled due date. The client's operational target is to halve this delinquency value to 6% within two academic terms.
*   **Staff Accounts Chasing Cost**: Eight accounts staff devote 50% of their working hours to phoning parents for overdue instalments and balance inquiries, representing 4 full-time equivalents (FTEs) at an annual cost of ₹4.20 Lakh per FTE: $4 \times \text{₹}4.20\text{ Lakh} = \text{₹}16.80\text{ Lakh/year}$.
*   **Total Recoverable Annual Baseline**: Combining fee leakage and staff chasing costs yields $\text{₹}62.40\text{ Lakh} + \text{₹}16.80\text{ Lakh} = \text{₹}79.20\text{ Lakh/year}$.

Against a client build budget of **₹6.00 Lakh** over a 6-week project timeline, the baseline client brief yields a **13.2x Year-1 Return on Investment (ROI)**, achieving full budget payback in less than 28 calendar days of operation.

To account for realistic operational adoption, the table below contrasts the brief's maximum recovery baseline against cautious and expected scenario models:

| Recovery Scenario | Leakage Recovered (%) | Staff Chasing Time Freed (%) | Gross Annual Benefit | Net 1st-Year Multiple (on ₹6.00L Budget) |
| :--- | :--- | :--- | :--- | :--- |
| **Cautious Case** | 25% | 40% | ₹22.32 Lakh | **3.7x** |
| **Expected Case** | 50% | 60% | ₹41.28 Lakh | **6.9x** |
| **Brief Baseline** | 100% | 100% | ₹79.20 Lakh | **13.2x** |

---

### 1.3 Sample Seed Data Verification and Anchor System Date
System evaluation is mathematically verified against three reference student rows, which pin the internal demo reference clock to **November 2, 2026 (2026-11-02)**:

| Student Code | Student Name | Batch Name | Due Date | Amount (₹) | Paid (₹) | Balance (₹) | System Status | Verification at Anchor Date 2026-11-02 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **STU-0412** | Aarav Meena | JEE 2027 Morning | 2026-10-10 | 30,000 | 30,000 | 0 | `PAID` | Instalment paid in full. Part of a 4-instalment quarterly plan ($4 \times \text{₹}30,000 = \text{₹}1,20,000/\text{yr}$). |
| **STU-0587** | Ishita Sharma | JEE 2027 Evening | 2026-10-10 | 30,000 | 15,000 | 15,000 | `PART_PAID_OVERDUE` | $2026\text{-}10\text{-}10$ to $2026\text{-}11\text{-}02 = \mathbf{23\text{ calendar days overdue}}$. Balance ₹15,000. |
| **STU-0219** | Mohit Gurjar | NEET 2027 Morning | 2026-11-15 | 40,000 | 0 | 40,000 | `UPCOMING` | $2026\text{-}11\text{-}15$ minus $2026\text{-}11\text{-}02 = \mathbf{13\text{ days until due}}$. Part of a 3-instalment trimester plan ($3 \times \text{₹}40,000 = \text{₹}1,20,000/\text{yr}$). |


## 2. System Architecture and Architectural Strategy

### 2.1 Four-Zone Topology
The platform decomposes into four distinct runtime zones that enforce strict separation of concerns between client presentation, application routing, ACID financial persistence, and guardrailed analytics:

```mermaid
flowchart TB
    subgraph Zone1["Zone 1: Client Presentation Tier"]
        PARENT["Bilingual Mobile Parent Portal\n(360x800px Responsive PWA)"]
        STAFF["Multi-Centre Accounts Workspace\n(Desktop / Tablet Dashboard)"]
    end

    subgraph Zone2["Zone 2: Application & API Gateway Tier"]
        ROUTER["Next.js 16 App Router\n(React 19.2 Server Actions & Route Handlers)"]
        AUTH["OTP Auth & RBAC Middleware\n(Signed HTTP-Only Sessions via Jose)"]
        DPDP_SVC["DPDP Consent Verification Service\n(Rule 10 Verifiable Parental Consent)"]
        WEBHOOK_ENGINE["Idempotent Payment Webhook Handler\n(HMAC-SHA256 Signature Verification)"]
    end

    subgraph Zone3["Zone 3: Core Domain & ACID Persistence Tier"]
        SQL_ENGINE["PostgreSQL 16 Transactional Engine\n(READ COMMITTED + Explicit Row Locks)"]
        PRISMA_ORM["Prisma 7 ORM\n(Type-Safe Query Layer for Reads)"]
        PAISE_LEDGER[("Paise Financial Ledger\n(64-bit Integer BigInt Storage)")]
        RECEIPT_GEN["Gapless GST Receipt Generator\n(Rule 46 / SAC 999293 Engine)"]
    end

    subgraph Zone4["Zone 4: Guardrailed AI & Analytics Tier"]
        DETERMINISTIC_SCORER["Deterministic Risk Scorer\n(Fees + Attendance + Test Slope)"]
        AI_ADAPTER["LLM Counsellor Script Generator\n(De-Identified JSON Payload Adapter)"]
        TASK_QUEUE[("Counsellor Call Task Queue\n(OPEN_CALL_TASK Isolation)")]
    end

    PARENT -->|HTTPS / REST / JSON| ROUTER
    STAFF -->|HTTPS / REST / JSON| ROUTER

    ROUTER --> AUTH
    AUTH --> DPDP_SVC
    ROUTER --> WEBHOOK_ENGINE

    WEBHOOK_ENGINE --> SQL_ENGINE
    ROUTER --> PRISMA_ORM
    PRISMA_ORM --> PAISE_LEDGER
    SQL_ENGINE --> PAISE_LEDGER
    SQL_ENGINE --> RECEIPT_GEN

    PRISMA_ORM -.Read-Only Metrics.-> DETERMINISTIC_SCORER
    DETERMINISTIC_SCORER --> AI_ADAPTER
    AI_ADAPTER --> TASK_QUEUE

    classDef zone fill:#f9f9f9,stroke:#333,stroke-width:1px;
    class Zone1,Zone2,Zone3,Zone4 zone;
```

---

### 2.2 Technology Stack Justification
The engineering specification selects a modern, type-safe stack evaluated against current vendor support policies:

| Layer | Chosen Technology | Version | Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `16.4.5` | Consolidates UI rendering and API Route Handlers into a single deployable unit. Version 16 provides long-term support (superseding Next.js 15 whose window closed in October 2026). |
| **UI Library** | React | `19.3.1` | Enables Server Components for low-latency initial renders on low-end 360px mobile viewports without client-side JavaScript overhead. |
| **Language** | TypeScript | `5.9.3` | Enforces strict static typing across domain models, API payloads, database models, and test assertions. |
| **Database Engine** | PostgreSQL | `16.15` | Provides mature ACID serializable row locking, native JSONB, generated columns, and robust role-based access security. |
| **Persistence ORM** | Prisma ORM & `pg` Driver | `7.10.1` / `8.23.1` | Uses Prisma 7 for read queries and administrative CRUD; uses the `pg` driver directly for explicit SQL transaction control, row locking, and column grants. |
| **Styling & Icons** | Tailwind CSS & Lucide Icons | `4.3.5` | Zero-runtime CSS generation providing utility-first responsive layout components tailored for high contrast and WCAG 2.2 AA accessibility. |
| **Authentication** | `jose` (JWT) & Crypto | `6.2.16` | Signed, HTTP-only session cookies with HMAC-SHA256 OTP hashing. No plain-text passwords stored. |
| **Testing** | Vitest & Playwright | `5.1.0` / `1.65.0` | Vitest executes unit/integration domain tests in under 1 second; Playwright automates end-to-end browser workflows across mobile and desktop. |

---

## 3. End-to-End System Execution Flow

The sequence diagram below details the execution lifecycle of a parent instalment payment arriving via payment gateway webhook, illustrating signature verification, database transaction boundary, gapless receipt generation, and atomic reminder suppression:

```mermaid
sequenceDiagram
    autonumber
    actor Gateway as Payment Gateway (Razorpay)
    participant Webhook as Webhook Route Handler (/api/webhooks/razorpay)
    participant DB as PostgreSQL 16 DB (pg Pool)
    participant Ledger as Instalments & Allocations
    participant Receipt as Receipt Counters & Receipts
    participant Reminder as Reminders Table
    participant Audit as Audit Log Table

    Gateway->>Webhook: POST /api/webhooks/razorpay (Headers + Raw JSON Body)
    activate Webhook

    Webhook->>Webhook: Extract Signature Header & Compute HMAC-SHA256 Over Raw Body
    alt Signature Verification Fails
        Webhook-->>Gateway: HTTP 400 Bad Request (Invalid Signature)
    end

    Webhook->>Webhook: Parse Payload with Zod (Filter Event: payment.captured)
    Webhook->>DB: BEGIN Transaction (READ COMMITTED)
    activate DB

    DB->>Ledger: INSERT INTO payments (gateway_payment_id, ...) ON CONFLICT DO NOTHING
    alt Duplicate Gateway Txn ID
        DB-->>Webhook: 0 Rows Inserted (Duplicate Event)
        Webhook-->>Gateway: HTTP 200 OK (Processed Idempotently)
    end

    DB->>Ledger: SELECT * FROM open_instalments WHERE student_id = $1 FOR UPDATE
    Ledger-->>DB: Locked Open Instalment Rows (Ordered by Due Date, Seq)

    DB->>Ledger: UPDATE instalments SET amount_paid_paise = amount_paid_paise + $amount, version = version + 1 WHERE id = $id AND version = $v
    DB->>Ledger: INSERT INTO payment_allocations (payment_id, instalment_id, head, amount_paise)

    DB->>Receipt: UPDATE receipt_counters SET last_no = last_no + 1 WHERE gstin = $gstin AND fy = $fy FOR UPDATE
    Receipt-->>DB: Incremented Sequential Number (e.g., 000412)
    DB->>Receipt: INSERT INTO receipts (receipt_no: RCP/26-27/000412, taxable, cgst, sgst, ...)

    alt Instalment Fully Paid (Balance = 0)
        DB->>Reminder: UPDATE reminders SET state = 'SUPPRESSED_BY_PAYMENT', suppressed_at = NOW(), suppress_payment_id = $payment_id WHERE instalment_id = $id AND state = 'QUEUED'
    end

    DB->>Audit: INSERT INTO audit_log (actor: SYSTEM_WEBHOOK, action: PAYMENT_RECORDED, ...)
    DB-->>Webhook: COMMIT Transaction Successful
    deactivate DB

    Webhook-->>Gateway: HTTP 200 OK (Payment Matched & Receipt Issued)
    deactivate Webhook
```

---

## 4. Production Directory Layout and Codebase Structure

The system is structured as a domain-driven monorepo separating framework entry points, pure domain primitives, database transaction handlers, and database migration scripts:

```text
shikshasetu-monorepo/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   └── login/
│       │   │       └── page.tsx                 # Sign-in & OTP modal with DPDP consent banner
│       │   ├── (parent)/
│       │   │   └── parent/
│       │   │       ├── dashboard/page.tsx       # Parent Mobile Home (5-second dues view)
│       │   │       └── pay/[id]/page.tsx        # Payment checkout simulation & receipt view
│       │   ├── (admin)/
│       │   │   └── admin/
│       │   │       ├── dashboard/page.tsx       # Multi-centre dues dashboard & ageing filters
│       │   │       ├── students/[id]/page.tsx   # Ledger view & unmatched payment queue
│       │   │       ├── reminders/page.tsx       # Bilingual reminder outbox & audit trail
│       │   │       └── refunds/page.tsx         # MoE pro-rata calculator & risk queue
│       │   └── api/
│       │       ├── auth/otp/route.ts            # OTP issuance & verification API
│       │       ├── pay/orders/route.ts          # Server-side payment order binding
│       │       ├── webhooks/razorpay/route.ts   # Signed payment webhook endpoint
│       │       ├── exports/tally/route.ts       # Tally Prime XML/CSV export generator
│       │       └── jobs/[name]/route.ts         # Cron endpoint (reminder run & risk scan)
│       ├── public/
│       │   └── fonts/                           # Noto Sans Devanagari subset font files
│       ├── Dockerfile                           # Multi-stage production container build
│       └── next.config.ts                       # Next.js 16 configuration & security headers
├── src/
│   ├── domain/                                  # Pure, framework-agnostic domain logic
│   │   ├── money.ts                             # Integer paise arithmetic & proportional splits
│   │   ├── dates.ts                             # IST calendar date helpers & financial year
│   │   ├── status.ts                            # Instalment status state machine
│   │   ├── ageing.ts                            # Overdue ageing bucket categorization
│   │   ├── gst.ts                               # SAC 999293 18% GST reverse-split math
│   │   ├── refund.ts                            # MoE 2024 / Rajasthan Act daily pro-rata refund
│   │   ├── risk.ts                              # Deterministic multi-factor dropout scorer
│   │   ├── receiptNo.ts                         # Rule 46 gapless receipt string format
│   │   ├── webhook.ts                           # HMAC-SHA256 signature verification
│   │   ├── tally.ts                             # Tally Prime XML voucher builder
│   │   └── index.ts                             # Central domain module export barrel
│   ├── db/                                      # PostgreSQL transaction handlers (pg driver)
│   │   ├── pg.ts                                # Pool configuration & custom type parsers
│   │   ├── tx.ts                                # Transaction wrapper with retry logic
│   │   ├── payments.ts                          # Atomic payment webhook transaction
│   │   ├── reminders.ts                         # Reminder creation & daily dispatch run
│   │   └── refunds.ts                           # Pro-rata refund raise/approve/settle transactions
│   └── ai/
│       └── guideAdapter.ts                      # De-identified LLM counsellor script adapter
├── sql/                                         # Database schema & security migration scripts
│   ├── 000_roles.sql                            # Production database roles (app_rw, risk_scanner)
│   ├── 001_schema.sql                           # 28 core database tables & constraints
│   ├── 002_integrity.sql                        # Triggers, generated columns & checks
│   └── 003_grants.sql                           # Least-privilege column grants & revokes
├── prisma/
│   └── schema.prisma                            # Introspected Prisma schema for read queries
├── tests/
│   ├── domain.test.ts                           # 34 Vitest unit tests for domain math
│   ├── db.test.ts                               # 19 Vitest integration tests against PostgreSQL
│   ├── integration-pure.test.ts                 # Webhook signature & Tally XML tests
│   └── e2e/                                     # Playwright browser automation suite
│       └── mobile-dues.spec.ts                  # 360px mobile dues view & 5-second test
├── package.json                                 # Workspace dependencies & script targets
└── tsconfig.json                                # Strict TypeScript 5.9.3 compilation rules
```


## 5. Core Domain Logic and Mathematical Proofs ("The Hard Part")

### 5.1 Instalment Ledger and Ageing State Machine
Instalment ledger state is evaluated deterministically. For any scheduled instalment $i$ with due date $D_i$, scheduled amount $A_i$, and cumulative matched payments $P_i$ evaluated at system date $D_{\text{eval}}$ (anchored to $2026\text{-}11\text{-}02$ in demo mode), the outstanding balance $B_i$ and day delta $d_i$ are defined by:

$$B_i = \max(0, A_i - P_i)$$

$$d_i = D_{\text{eval}} - D_i \quad (\text{in whole calendar days})$$

The system evaluates state according to the non-overlapping conditions in the matrix below:

| Condition | Internal State Enum | Display Label (English) | Display Label (Hindi) |
| :--- | :--- | :--- | :--- |
| $\text{Cancelled via refund}$ | `CANCELLED_ON_REFUND` | Cancelled | रद्द |
| $P_i \ge A_i$ | `PAID` | Paid | चुकाया गया |
| $P_i = 0 \text{ and } d_i \le 0$ | `UPCOMING` | Due in $|d_i|$ days (if $d_i=0$: Due today) | देय $|d_i|$ दिन में (आज देय) |
| $0 < P_i < A_i \text{ and } d_i \le 0$ | `PART_PAID_UPCOMING` | Part paid, due in $|d_i|$ days | आंशिक भुगतान, $|d_i|$ दिन में देय |
| $P_i = 0 \text{ and } d_i > 0$ | `OVERDUE` | $d_i$ days overdue | $d_i$ दिन अतिदेय |
| $0 < P_i < A_i \text{ and } d_i > 0$ | `PART_PAID_OVERDUE` | Part paid, $d_i$ days overdue | आंशिक भुगतान, $d_i$ दिन अतिदेय |

Instalments with an outstanding balance ($B_i > 0$ and $d_i > 0$) are categorized into four mutually exclusive ageing buckets:
1.  **1–30 Days Overdue**: $1 \le d_i \le 30$ (Holds STU-0587 Ishita Sharma at 23 days).
2.  **31–60 Days Overdue**: $31 \le d_i \le 60$.
3.  **>60 Days Overdue**: $d_i \ge 61$ (Monitors the client's strategic metric to halve >60-day delinquency value from 12% to 6%).

---

### 5.2 Statutory 18% GST Reverse-Split Math (SAC 999293)
Commercial entrance coaching is taxed at **18% GST** (9% CGST + 9% SGST for intra-state supplies in Rajasthan under SAC 999293). To maintain clean course fees for parents while generating compliant receipts, the engine reverse-calculates tax components from any gross payment $G$ (in integer paise).

To ensure central and state tax components remain strictly equal without floating-point rounding discrepancies, the single tax component $T$ is computed using round-half-up integer division:

$$T = \text{round}_{\text{half up}}\!\left(\frac{9 \cdot G}{118}\right) = \left\lfloor \frac{18 \cdot G + 118}{236} \right\rfloor$$

$$\text{CGST} = T, \quad \text{SGST} = T, \quad \text{Taxable Base} = G - 2 \cdot T$$

This guarantees that $\text{Taxable Base} + \text{CGST} + \text{SGST} = G$ to the exact paisa across all payment values:

| Gross Amount $G$ | Taxable Base (₹) | CGST 9% (₹) | SGST 9% (₹) | Total Receipt Value (₹) |
| :--- | :--- | :--- | :--- | :--- |
| **₹15,000.00** (STU-0587 Part Payment) | ₹12,711.86 | ₹1,144.07 | ₹1,144.07 | ₹15,000.00 |
| **₹30,000.00** (JEE Quarterly Payment) | ₹25,423.72 | ₹2,288.14 | ₹2,288.14 | ₹30,000.00 |
| **₹40,000.00** (NEET Trimester Payment) | ₹33,898.30 | ₹3,050.85 | ₹3,050.85 | ₹40,000.00 |
| **₹1,20,000.00** (Full Annual Course Fee) | ₹1,01,694.92 | ₹9,152.54 | ₹9,152.54 | ₹1,20,000.00 |

---

### 5.3 Pro-Rata Refund Engine (MoE Guidelines & Rajasthan Act 2025)
Under Section 13(4) of the **Rajasthan Coaching Centres (Control and Regulation) Act, 2025** and the Union Ministry of Education 2024 Coaching Centre Guidelines, a student withdrawing midway through a course is entitled to a daily pro-rata refund covering tuition, hostel, and mess fees within **10 calendar days**.

For each fee head $h \in \{\text{TUITION}, \text{HOSTEL}, \text{MESS}\}$, let $N_h$ be net annual fee, $\text{Paid}_h$ cumulative fees paid, $C_h$ total course days (360 days), and $e$ calendar days elapsed from batch start (or enrolment date) to withdrawal request date:

$$\text{Consumed}_h = \text{round}_{\text{half up}}\!\left(N_h \cdot \frac{e}{C_h}\right)$$

$$\text{Refund}_h = \max\!\left(0, \text{Paid}_h - \text{Consumed}_h\right)$$

$$\text{Total Refund} = \sum_{h} \text{Refund}_h, \quad \text{SLA Settlement Deadline} = D_{\text{request}} + 10\text{ calendar days}$$

The floor at zero applies per fee head, preventing hostel fee shortfalls from offsetting tuition refunds. The engine was verified across six standard test cases:

```text
Case A (Upfront Full Payer, Day 180 of 360):
  Paid: ₹1,20,000 | Consumed: ₹60,000 | Refund: ₹60,000.00 | Unbilled Cancelled: None

Case B (Instalment Payer Ahead of Schedule, Day 216 of 360):
  Paid: ₹90,000 | Consumed: ₹72,000 | Refund: ₹18,000.00 | Unbilled Instalment 4 (₹30,000) Cancelled

Case C (Part-Paid Student Mid-Course Exit, Day 216 of 360 - STU-0587):
  Paid: ₹75,000 | Consumed: ₹72,000 | Refund: ₹3,000.00 | Overdue ₹15,000 & Instalment 4 Cancelled

Case D (Pre-Batch Withdrawal, Day 0 of 360):
  Paid: ₹30,000 | Consumed: ₹0 | Refund: ₹30,000.00 | All Future Instalments Cancelled

Case E (Fee Shortfall, Day 216 of 360):
  Paid: ₹60,000 | Consumed: ₹72,000 | Refund: ₹0.00 | Shortfall ₹12,000 Flagged (Not Auto-Charged)

Case F (Multi-Head Exit, Tuition + Hostel):
  Tuition Paid ₹90,000 (Cons. ₹72,000 -> Ref. ₹18,000) | Hostel Paid ₹30,000 (Cons. ₹36,000 -> Shortfall ₹6,000)
  Total Settled Refund: ₹18,000.00 (Hostel shortfall not netted against tuition refund)
```

---

### 5.4 Explainable AI Student Dropout-Risk Engine
To identify students at risk of dropping out without violating regulatory tracking guardrails, ShikshaSetu implements a **Two-Stage Hybrid Risk Engine**.

#### Stage 1: Deterministic Multi-Factor Scoring
A composite risk score $R \in [0, 100]$ is computed from three weighted domain sub-scores:

$$R = F + A + S$$

1.  **Fee Delinquency Factor ($F$, max 40 points)**: Scales linearly with worst overdue days $d_{\text{overdue}}$ up to 30 days, plus a 5-point stress indicator for partial payments:
    $$F = \text{round}\!\left(35 \cdot \min\!\left(1, \frac{d_{\text{overdue}}}{30}\right)\right) + 5 \cdot \mathbb{I}(0 < P < A)$$

2.  **Attendance Factor ($A$, max 35 points)**: Evaluates monthly attendance percentage $a$ against the 80% benchmark (maxing points at $\le 65\%$), plus a 10-point penalty for a month-over-month drop exceeding 10 percentage points ($a_{\text{prev}} - a > 10$):
    $$A = \begin{cases} 0 & a \ge 80 \\ 25 & a \le 65 \\ \text{round}\!\left(25 \cdot \frac{80 - a}{15}\right) & 65 < a < 80 \end{cases} \; + \; 10 \cdot \mathbb{I}(a_{\text{prev}} - a > 10)$$

3.  **Test Trend Slope Factor ($S$, max 25 points)**: Measures negative slope across the student's three most recent batch test percentiles ($t_{\text{old}} - t_{\text{new}}$):
    $$S = \text{round}\!\left(25 \cdot \min\!\left(1, \frac{\max(0, t_{\text{old}} - t_{\text{new}})}{25}\right)\right)$$

Students scoring 50–69 are classified as `MEDIUM` risk, and 70–100 as `HIGH` risk. For seeded student **STU-0587 (Ishita Sharma)**, the engine evaluates:
*   $F = \text{round}(35 \times 23 / 30) + 5 = 27 + 5 = \mathbf{32}$
*   $A = \text{round}(25 \times (80 - 69) / 15) + 10 = 18 + 10 = \mathbf{28}$
*   $S = \text{round}(25 \times (78 - 59) / 25) = \mathbf{19}$
*   **Total Score $R = 32 + 28 + 19 = \mathbf{79 \quad (HIGH\ RISK)}$**

#### Stage 2: Guardrailed Counsellor Script Generation
For students with $R \ge 50$, the system generates a 3-bullet empathetic call script in English and Hindi. Three strict architectural guardrails govern this stage:
*   **Operational Boundary**: High risk scores create an entry in the `dropout_flags` table (`task_status = 'OPEN_CALL_TASK'`) for the Academic Counsellor queue. Code boundaries prevent any invocation of payment gateways or WhatsApp reminder dispatchers.
*   **De-Identified Payload**: LLM adapter payloads contain only factor numbers ($F, A, S$) and days overdue. Personal names, phone numbers, and student codes are stripped prior to API transit.
*   **Offline Fallback**: If the LLM API times out (4-second threshold) or returns invalid JSON, the service seamlessly falls back to a deterministic bilingual script template.


## 6. Database Architecture and Data Model

The PostgreSQL 16 schema consists of **28 core tables** enforcing ACID transactional guarantees, integer paise financial storage, and append-only audit logging:

```mermaid
erDiagram
    centres ||--o{ batches : "hosts"
    batches ||--o{ fee_plans : "defines"
    fee_plans ||--o{ fee_plan_lines : "contains"
    centres ||--o{ students : "enrols"
    batches ||--o{ students : "places"
    users ||--o{ guardians : "identifies"
    students ||--o{ guardians : "linked_to"
    students ||--o{ student_fees : "billed"
    students ||--o{ dpdp_consents : "consents"
    students ||--o{ instalments : "scheduled"
    fee_plan_lines ||--o{ instalments : "generates"
    instalments ||--o{ instalment_heads : "splits"
    students ||--o{ payments : "makes"
    instalments ||--o{ payments : "targets"
    payments ||--o{ payment_allocations : "allocates"
    instalments ||--o{ payment_allocations : "credited_by"
    payments ||--o{ receipts : "issues"
    receipt_counters ||--o{ receipts : "numbers"
    instalments ||--o{ reminders : "schedules"
    students ||--o{ refund_requests : "requests"
    refund_requests ||--o{ refund_lines : "details"
    refund_requests ||--o{ receipts : "generates_credit_note"
    students ||--o{ academic_metrics : "records"
    students ||--o{ dropout_flags : "flagged"
    users ||--o{ audit_log : "performs"

    centres {
        uuid id PK
        string code UK
        string name
        string gstin
    }
    students {
        uuid id PK
        string student_code UK
        string full_name
        date dob
        boolean is_minor
    }
    instalments {
        uuid id PK
        uuid student_id FK
        int seq_no
        date due_date
        bigint amount_due_paise
        bigint amount_paid_paise
        int version
    }
    payments {
        uuid id PK
        string gateway_payment_id UK
        bigint amount_paise
        string match_status
        timestamp paid_at
    }
    receipts {
        uuid id PK
        uuid payment_id FK
        string number UK
        bigint gross_paise
        bigint taxable_paise
        bigint cgst_paise
        bigint sgst_paise
    }
    reminders {
        uuid id PK
        uuid instalment_id FK
        string trigger_type
        date scheduled_for
        string state
    }
    dropout_flags {
        uuid id PK
        uuid student_id FK
        int risk_score
        string severity
        string task_status
    }
```

---

### 6.1 Database Table Schema Catalogue
The table below documents the 28 relational tables comprising the PostgreSQL database:

| # | Table Name | Key Columns & Types | Primary Purpose & Domain Invariants |
| :--- | :--- | :--- | :--- |
| 1 | `centres` | `id` (UUID PK), `code` (UK), `name`, `gstin`, `registration_no` | Stores the 4 Jaipur coaching centres and legal registration numbers. |
| 2 | `batches` | `id` (UUID PK), `centre_id` (FK), `code`, `name`, `stream`, `course_days` | Defines academic streams (JEE/NEET) and standard 360-day course length. |
| 3 | `users` | `id` (UUID PK), `phone` (UK), `name`, `role`, `preferred_lang` | Unified user table for RBAC (`PARENT`, `ACCOUNTS_EXEC`, `COUNSELLOR`, `DIRECTOR`). |
| 4 | `user_centres` | `user_id` (FK), `centre_id` (FK) | Maps staff users to assigned centres for data scoping. |
| 5 | `students` | `id` (UUID PK), `student_code` (UK), `full_name`, `dob`, `is_minor` | Core student record storing minor status and enrolment state. |
| 6 | `guardians` | `student_id` (FK), `user_id` (FK), `relationship`, `id_last4` | Links up to 2 parents per student. Stores ID type and last 4 characters only. |
| 7 | `student_fees` | `student_id` (FK), `head`, `gross_paise`, `discount_paise`, `net_paise` | Fee breakdown by head. `net_paise` is a generated column (`gross - discount`). |
| 8 | `fee_plans` | `id` (UUID PK), `batch_id` (FK), `name`, `instalment_count` | Defines instalment plan structures (mandating $\ge 4$ equal instalments). |
| 9 | `fee_plan_lines` | `plan_id` (FK), `seq`, `due_date`, `weight_bp` | Schedule weights in basis points (must sum to 10,000 per plan). |
| 10 | `instalments` | `id` (UUID PK), `student_id` (FK), `due_date`, `amount_due_paise`, `version` | Scheduled instalment ledger featuring optimistic concurrency control (`version`). |
| 11 | `instalment_heads`| `instalment_id` (FK), `head`, `amount_due_paise` | Splits individual instalment amounts across tuition, hostel, and mess heads. |
| 12 | `payments` | `id` (UUID PK), `gateway_payment_id` (UK), `amount_paise`, `match_status` | Append-only payment queue. Unmatched payments land in `UNMATCHED_QUEUE`. |
| 13 | `payment_allocations`| `payment_id` (FK), `instalment_id` (FK), `head`, `amount_paise` | Immutable ledger recording exact paisa credit allocations per fee head. |
| 14 | `receipt_counters` | `gstin`, `fy`, `kind`, `last_no` | Row-locked sequential counters for gapless Rule 46 GST receipt numbering. |
| 15 | `receipts` | `id` (UUID PK), `payment_id` (FK), `number` (UK), `taxable_paise` | Immutable GST receipts and credit notes. Unique on `(gstin, fy, kind, number)`. |
| 16 | `reminders` | `id` (UUID PK), `instalment_id` (FK), `trigger_type`, `state` | Reminder outbox state machine (`QUEUED`, `SENT`, `SUPPRESSED_BY_PAYMENT`). |
| 17 | `refund_requests` | `id` (UUID PK), `student_id` (FK), `received_on`, `sla_due_date`, `status` | MoE pro-rata refund tracker enforcing raiser $\ne$ approver database check. |
| 18 | `refund_lines` | `refund_id` (FK), `head`, `consumed_paise`, `refund_paise` | Audit record of per-head fee consumption and refundable math. |
| 19 | `academic_metrics` | `student_id` (FK), `period_label`, `attendance_bp`, `score_bp` | Stores batch attendance and test score percentiles in integer basis points. |
| 20 | `dropout_flags` | `id` (UUID PK), `student_id` (FK), `risk_score`, `task_status` | Counsellor call queue. Enforces max 1 open flag per student via partial index. |
| 21 | `dpdp_consents` | `id` (UUID PK), `student_id` (FK), `parent_user_id` (FK), `purpose_code` | DPDP Rule 10 consent log supporting Section 6(4) withdrawal tracking. |
| 22 | `data_requests` | `student_id` (FK), `type`, `status`, `due_on` | Parent data correction and erasure request tracking. |
| 23 | `audit_log` | `id` (UUID PK), `actor_user_id`, `action`, `before_json`, `after_json` | Append-only security audit log. `app_rw` role cannot UPDATE or DELETE. |
| 24 | `system_settings` | `key` (PK), `value`, `updated_by`, `updated_at` | Global configuration switches and risk thresholds. |
| 25 | `otp_challenges` | `phone_hash` (FK), `code_hash`, `expires_at`, `attempts` | Hashed OTP challenges enforcing 5-minute expiry and 5-try lockout. |
| 26 | `sessions` | `id` (UUID PK), `user_id` (FK), `issued_at`, `expires_at`, `revoked_at` | Signed HTTP-only session store supporting instant revocation. |
| 27 | `csv_uploads` | `id` (UUID PK), `file_hash` (UK), `rows_ok`, `rows_rejected` | Tracks CSV batch metric uploads; prevents duplicate file processing. |
| 28 | `tally_exports` | `id` (UUID PK), `exported_by`, `voucher_count`, `total_paise` | Audit log of Tally Prime XML/CSV voucher exports. |


## 7. Statutory, Legal, and Regulatory Compliance Architecture

### 7.1 Digital Personal Data Protection (DPDP) Act 2023 & DPDP Rules 2025
Because entrance coaching students in Class 11 and 12 are under 18 years of age, they are classified as minors under Section 2(f) of the DPDP Act 2023. The platform enforces compliance across four statutory duties:

1.  **Verifiable Parental Consent (Section 9(1) & Rule 10)**: Rule 10 requires verifying that the person granting consent is an identifiable adult. ShikshaSetu links the parent’s mobile OTP login to the adult guardian KYC record captured during physical admission (`guardians.id_last4`) before displaying student data.
2.  **Bilingual Itemized Notice (Sections 5 & 6)**: Parents receive an itemized notice in English and Hindi (Devanagari script) specifying data processing purposes (`CORE_EDUCATION_FEES`, `WHATSAPP_REMINDERS`, `RISK_SCORING`).
3.  **Consent Withdrawal (Section 6(4))**: Parents can withdraw consent for optional processing (e.g., WhatsApp reminders) with a single tap in settings. Withdrawal sets `withdrawn_at` in `dpdp_consents` and automatically transitions queued reminders to `SUPPRESSED_BY_PAYMENT` with reason `CONSENT_WITHDRAWN`.
4.  **Statutory Retention & Security Safeguards (Section 8(5) & 8(7))**: Data is encrypted in transit (TLS 1.3) and at rest. Tax receipts and financial ledgers are retained for **72 months** as required by Indian tax law, overriding general data erasure requests. Statutory penalty caps (up to **₹250 Crore** for security failures and **₹200 Crore** for minor data non-compliance) drive these technical controls.

---

### 7.2 Rajasthan Coaching Centres (Control and Regulation) Act, 2025
As the binding state law for Jaipur coaching operations, the system natively implements Section 6, 7, and 13 mandates:
*   **Mandatory Equal Instalments (Section 6(2)(d))**: Batches must offer a fee plan of four or more equal instalments. System validation blocks saving any batch that lacks a 4-instalment option.
*   **Official Receipts (Section 13(1))**: Official GST receipts are issued for every fee payment, displaying the centre's state registration number, address, and GSTIN.
*   **10-Day Pro-Rata Refund (Section 13(4))**: Mid-course exits trigger daily pro-rata refunds covering tuition, hostel, and mess fees within 10 calendar days.
*   **Prohibition of Mid-Course Hikes (Section 13(5))**: Enrolled fee plans cannot be modified. Any fee reduction or scholarship requires an audited exception approved by the Director.

---

### 7.3 Income Tax Act Cash Limit Check (Section 269ST / Act 2025)
To protect the coaching institute from statutory cash penalties (where receiving ₹2,00,000 or more in cash from one person in a single day incurs a 100% penalty), the offline payment handler (`FR-PAY-09`) evaluates cumulative daily cash payments per payer:
*   Cash transactions of **₹2,00,000 or more** are blocked on the server, returning HTTP 422 Unprocessable Entity.
*   Transactions of ₹1,99,999 or less are accepted and logged in the audit trail.


## 8. API Interface Contracts and Error Handling Standards

All non-2xx HTTP responses adhere strictly to the **RFC 9457 Problem Details** standard using the `application/problem+json` media type:

```json
{
  "type": "urn:shikshasetu:error:validation-error",
  "title": "Invalid Request Parameters",
  "status": 400,
  "detail": "The payment payload failed validation. The specified part payment is below the minimum threshold.",
  "instance": "/api/pay/orders",
  "traceId": "00-8f3a9b2c1d4e5f6a-7b8c9d0e1f2a3b4c-01",
  "invalid-params": [
    {
      "name": "amountPaise",
      "reason": "Part payment amount (₹300.00) is below the minimum allowed threshold of ₹500.00 (50,000 paise).",
      "code": "BELOW_MINIMUM_THRESHOLD"
    }
  ]
}
```

The system maps domain exceptions to RFC 9457 HTTP responses according to the specification matrix:

| Domain Exception Condition | HTTP Status | RFC 9457 `type` URI Suffix | Extensibility Payload Fields |
| :--- | :--- | :--- | :--- |
| **Invalid Signature / Malformed Payload** | 400 Bad Request | `/errors/bad-request` | `parseErrorReason` |
| **Expired Session / Invalid OTP** | 401 Unauthorized | `/errors/unauthorized` | `authScheme`, `realm` |
| **Role / Scope Permission Violation** | 403 Forbidden | `/errors/forbidden` | `requiredRole`, `userScope` |
| **Resource Not Found in Scope** | 404 Not Found | `/errors/not-found` | `resourceId`, `resourceType` |
| **Optimistic Version Lock Conflict** | 409 Conflict | `/errors/version-conflict` | `currentVersion`, `submittedVersion` |
| **Cash Limit / Below Min Threshold** | 422 Unprocessable | `/errors/business-rule-violation` | `invalid-params` (Array) |
| **OTP Rate Limit Exceeded** | 429 Too Many Requests | `/errors/rate-limit-exceeded` | `retryAfterSeconds` |
| **Internal Database Exception** | 500 Internal Error | `/errors/internal-error` | `traceId` (Stack trace suppressed) |


## 9. Automated Test Suite and Verification Matrix

The platform specification includes 23 structured automated test cases (**TC-01 through TC-23**):

| Test ID | Test Subject & Scenario | Expected Assertion & Deterministic Outcome | Implementation Status |
| :--- | :--- | :--- | :--- |
| **TC-01** | Verification of sample student rows at anchor date $2026\text{-}11\text{-}02$. | STU-0412 $\rightarrow$ `PAID` (₹0 due); STU-0587 $\rightarrow$ `PART_PAID_OVERDUE` (23d late, ₹15,000 due); STU-0219 $\rightarrow$ `UPCOMING` (due in 13d). | **Passed (34 domain tests)** |
| **TC-02** | 18% GST reverse split across ₹15k, ₹30k, ₹40k, ₹120k, and 100,000 gross values. | CGST equals SGST to the exact paisa; Taxable + CGST + SGST === Gross across all 100,000 values. | **Passed (Domain suite)** |
| **TC-03** | MoE 2024 / Rajasthan Act pro-rata refund Cases A to F. | Case A $\rightarrow$ ₹60,000; Case B $\rightarrow$ ₹18,000; Case C $\rightarrow$ ₹3,000; Case D $\rightarrow$ ₹30,000; Case E $\rightarrow$ ₹0 (₹12k shortfall). | **Passed (Domain suite)** |
| **TC-04** | Webhook payment execution for STU-0587 remaining ₹15,000. | Instalment becomes `PAID`; all 5 queued reminders transition atomically to `SUPPRESSED_BY_PAYMENT`. | **Passed (19 DB tests)** |
| **TC-04b**| Webhook idempotency and fault injection. | Replaying same gateway ID returns HTTP 200 OK with zero duplicate credit; injected faults roll back cleanly. | **Passed (DB suite)** |
| **TC-05** | AI dropout-risk score for STU-0587. | Score evaluates to exactly 79 (`HIGH` risk); generates `OPEN_CALL_TASK` with zero fee mutations. | **Passed (Domain suite)** |
| **TC-06** | Ageing bucket boundaries ($d = 0, 1, 30, 31, 60, 61$). | $d=30 \rightarrow$ 1–30d bucket; $d=31, 60 \rightarrow$ 31–60d bucket; $d=61 \rightarrow$ >60d bucket. Sum matches total overdue. | **Passed (Domain suite)** |
| **TC-07** | Reminder dispatch state machine & 24h quiet period. | Anchor mode sends nothing; part payment keeps reminders running with 24h quiet window; rerun sends 0 duplicates. | **Passed (DB suite)** |
| **TC-08** | Unmatched payment queue routing & manual resolution. | Unreferenced NEFT transfer routes to `UNMATCHED_QUEUE`; staff resolution issues receipt and updates ledger. | **Passed (DB suite)** |
| **TC-09** | Concurrency: 200 parallel payments executing against receipt counters. | 200/200 payments succeed under `READ COMMITTED` with explicit locks; receipt numbers 1..200 gapless in 872ms. | **Passed (DB concurrency)** |
| **TC-10** | RBAC & data scoping access matrix verification. | Parent requesting foreign student ID returns HTTP 403 Forbidden and writes audit log entry. | **Designed (API test)** |
| **TC-11** | AI guardrail failure isolation & offline template fallback. | Offline LLM API or malformed JSON falls back to deterministic bilingual template; risk scan completes cleanly. | **Passed (Domain suite)** |
| **TC-12** | Refund workflow & segregation-of-duties enforcement. | Self-approval by raiser blocked by database constraint; Director approval cancels future instalments. | **Passed (DB suite)** |
| **TC-13** | Fee plan validation (mandatory $\ge 4$ equal instalments). | Batches lacking a 4-instalment equal plan fail validation; last line absorbs paisa remainder. | **Passed (Domain suite)** |
| **TC-14** | DPDP consent capture & reminder suppression on withdrawal. | Consent withdrawal suppresses queued reminders with reason `CONSENT_WITHDRAWN`. | **Passed (DB suite)** |
| **TC-15** | Tally Prime XML export generation & voucher balance validation. | Exported XML is well-formed; debits equal credits; voucher GUIDs remain stable across re-exports. | **Passed (Integration suite)** |
| **TC-16** | Income tax cash limit check (₹2,00,000 threshold). | Cash entry of ₹2,00,000 returns HTTP 422 Unprocessable; entry of ₹1,99,999 succeeds. | **Designed (API test)** |
| **TC-17** | Bilingual UI string coverage & layout shift verification. | 100% of UI strings exist in English and Hindi dictionaries; zero layout shift on language toggle. | **Designed (UI test)** |
| **TC-18** | Security audit log append-only enforcement & grant checks. | Attempting `UPDATE` or `DELETE` on `audit_log` or `receipts` fails with database permission denied error. | **Passed (DB role test)** |
| **TC-19** | CSV batch metric upload validation & duplicate rejection. | Malformed CSV rows report line errors; uploading identical file hash twice is rejected. | **Designed (API test)** |
| **TC-20** | Multi-timezone execution consistency (UTC, IST, PST). | All 61 tests pass identically across UTC, Asia/Calcutta, and America/Los_Angeles process timezones. | **Passed (Suite test)** |
| **TC-21** | UI crawl: Zero dead buttons across all 7 core screens. | Automated Playwright crawl clicks every button control as each role; zero unhandled errors. | **Designed (E2E test)** |
| **TC-22** | Automated accessibility audit. | Automated accessibility check passes across all 7 core screens. | **Designed (E2E test)** |
| **TC-23** | Production build demo-feature exclusion scan. | Build check verifies that demo review bar, on-screen OTP toast, and anchor clock toggle are absent from production bundle. | **Designed (Build check)** |


## 10. Architecture Decision Records (ADRs) and Technical Debt Register

### 10.1 Architectural Decision Log

#### ADR-001: Selection of PostgreSQL 16 as Single Relational Database Engine
*   **Status**: Accepted.
*   **Context**: Core financial ledgers require strict ACID compliance, serializable row locking, integer arithmetic constraints, and complex multi-table analytics across multi-centre operations.
*   **Evaluated Options**:
    1.  *PostgreSQL 16 (Selected)*: Offers mature ACID transactional isolation, generated columns, partial indexes, and granular column-level security grants.
    2.  *MongoDB 7.0 (Rejected)*: Lacks native multi-document serializable locks required for gapless receipt counters.
*   **Consequences**: Standardizes production infrastructure on managed PostgreSQL 16 in the Mumbai region.

#### ADR-002: RFC 9457 Problem Details Standardization
*   **Status**: Accepted.
*   **Context**: Client and server integration requires a machine-parsable, standardized error format across all REST API endpoints.
*   **Evaluated Options**:
    1.  *RFC 9457 JSON (Selected)*: Provides a standard IETF schema (`application/problem+json`) supporting custom extension arrays for validation errors.
    2.  *Custom Error JSON (Rejected)*: Increases client integration overhead and lacks standard tooling support.
*   **Consequences**: Global exception handlers format all non-2xx API responses into RFC 9457 structures.

#### ADR-003: Database Transaction Isolation & Concurrency Control Strategy
*   **Status**: Accepted (Differs from initial PRD recommendation of `SERIALIZABLE`).
*   **Context**: Benchmarking 50 concurrent payment webhooks hitting a single receipt counter under `SERIALIZABLE` resulted in 19 serialization failures due to heavy counter row contention.
*   **Evaluated Options**:
    1.  *`READ COMMITTED` with Explicit Row Locking (Selected)*: Executes transactions under `READ COMMITTED` isolation using explicit `SELECT ... FOR UPDATE` locks on target instalment and counter rows. Under test, 200/200 parallel payments succeeded in 872ms with zero gaps.
    2.  *`SERIALIZABLE` (Rejected)*: Caused high retry overhead and transaction aborts under concurrent load.
*   **Consequences**: Financial transactions use explicit row locks under `READ COMMITTED` with up to 3 automatic retries on transient deadlock error codes (`40001`, `40P01`).

---

### 10.2 Technical Debt Risk Register

| Risk ID | Category | Technical Description & System Impact | Severity | Planned Remediation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **TD-01** | Database | Receipt counter row lock creates a minor bottleneck during high-concurrency surge events (4ms per payment). | Medium | Implement multi-sequence receipt blocks or per-centre counter partitioning if transactions exceed 100 req/sec. |
| **TD-02** | Messaging | In-app outbox simulator requires live DLT SMS / WhatsApp Business API gateway integration for production. | Medium | Integrate DLT-approved SMS provider adapter and WhatsApp Utility template dispatcher during Phase 2. |
| **TD-03** | Auth | Parent OTP challenges currently rely on synthetic demo SMS logging. | Low | Connect TRAI DLT-registered SMS gateway for live OTP dispatch during Phase 2 pilot onboarding. |
| **TD-04** | Analytics | LLM counsellor script generation depends on external API availability. | Low | System already incorporates a zero-latency deterministic template fallback ensuring 100% operational uptime. |
