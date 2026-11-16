# @jobsoxo/staged-billing

Deposit, progress and final invoice math for contractors. Per-line percent
complete, invoiced-to-date, change orders that raise the contract. Pure
functions, zod-validated, no database.

Extracted from [JobsOxo](https://github.com/HeidiW/jobsoxo-packages), the back
office for painting contractors.

## The problem

A contractor's job is a contract: a list of priced scope lines that add up to
a total. The customer rarely pays it in one go. They pay a deposit up front,
one or more progress payments as the work gets done, and the balance at the
end. Each of those is an invoice, but none of them stands on its own: what a
progress invoice may bill depends on how much work is done *and* on what the
earlier invoices already covered. Get that wrong and you double-bill the
deposit, or let a stage bill past the contract.

This package is the arithmetic and the wording for that, and nothing else:

- **Contract total** from the job's scope lines.
- **Deposit** as a dollar amount or a percent of the contract.
- **Progress** as an amount, a percent, or a *per-line percent complete*
  (standard progress billing: bill the value of work done so far, minus what
  was invoiced before, so a deposit is credited automatically).
- **Final** for whatever is left.
- **Guards** that cap any stage at the remaining balance and explain, in plain
  language, why a stage can't be created yet.
- **Change orders** raise the contract by appearing as extra scope lines, so
  the deposit stays as it was and the final invoice picks up the difference.

Everything is a pure function over plain data. Store the inputs however you
like.

## Install

```sh
npm install @jobsoxo/staged-billing zod
```

`zod` is a peer dependency (v3.23+ or v4). The package ships ESM and CommonJS
builds with TypeScript types.

## Worked example: a $12,000 job

Three scope lines. The painter wants 30% up front, then bills progress twice
as rooms are finished, then the balance.

```ts
import {
  contractFromLineItems, suggestedPercents, completedToDate, overallPercent,
  stageDueAmount, stageProblem, stageLineDescription,
} from "@jobsoxo/staged-billing";

const { scope, total } = contractFromLineItems([
  { section: "Interior", description: "Walls: protect, prep, prime and paint", amount: "5200",    status: "completed" },
  { section: "Interior", description: "Ceilings: two coats flat",              amount: "6000.00", status: "in_progress" },
  { section: "Interior", description: "Trim and doors: semi-gloss",            amount: 800,       status: "pending" },
]);
// total === 12000
// scope === [{ section: "Interior", description: "Walls: ...", amount: 5200, status: "completed" }, ...]

let invoiced = 0; // running total of what earlier (sent) invoices billed
```

Amounts come in as strings or numbers, the way they come out of a form or a
database, and go out as numbers rounded to cents.

### 1. Deposit: 30% of the contract

```ts
const deposit = { type: "percent", value: 30 } as const;

stageProblem("deposit", deposit, total, invoiced, scope);          // null  (nothing wrong, go ahead)
stageDueAmount("deposit", deposit, total, invoiced, scope);        // 3600
stageLineDescription("deposit", deposit, total, scope);            // "Deposit (30% of $12,000.00 contract)"

invoiced += 3600;                                                  // 3600
```

### 2. Progress payment 1: walls done, ceilings half done

Per-line percents are given in scope order. `suggestedPercents` reads a
starting point off each line's work status (completed 100, in progress 50,
pending 0); the user can adjust from there.

```ts
suggestedPercents(scope);                                          // [100, 50, 0]
const progress1 = { type: "lines", percents: [100, 50, 0] } as const;

completedToDate(scope, progress1.percents);                        // 8200   (5200 + 3000 + 0)
overallPercent(scope, progress1.percents, total);                  // 68.3   (8200 / 12000, price-weighted)
stageProblem("progress", progress1, total, invoiced, scope);       // null
stageDueAmount("progress", progress1, total, invoiced, scope);     // 4600   (8200 done − 3600 already invoiced)
stageLineDescription("progress", progress1, total, scope, 1);      // "Progress payment 1 (work 68.3% complete on $12,000.00 contract)"

invoiced += 4600;                                                  // 8200
```

The deposit was credited without any special handling: the invoice bills work
done to date minus everything invoiced before.

### 3. Progress payment 2: ceilings done, trim half done

```ts
const progress2 = { type: "lines", percents: [100, 100, 50] } as const;

completedToDate(scope, progress2.percents);                        // 11600
overallPercent(scope, progress2.percents, total);                  // 96.7
stageProblem("progress", progress2, total, invoiced, scope);       // null
stageDueAmount("progress", progress2, total, invoiced, scope);     // 3400   (11600 − 8200)
stageLineDescription("progress", progress2, total, scope, 2);      // "Progress payment 2 (work 96.7% complete on $12,000.00 contract)"

invoiced += 3400;                                                  // 11600
```

If the percents don't add up to more than what's already been billed, the
guard says so instead of producing a zero invoice:

```ts
const tooEarly = { type: "lines", percents: [100, 100, 0] } as const;
stageProblem("progress", tooEarly, total, invoiced, scope);
// "Work completed to date ($11,200.00) is already covered by the $11,600.00 invoiced before. Raise the percentages or wait until more is done."
stageDueAmount("progress", tooEarly, total, invoiced, scope);      // 0
```

### 4. Final invoice: the rest

A final stage takes no basis. It bills whatever the earlier stages left.

```ts
stageProblem("final", null, total, invoiced, scope);               // null
stageDueAmount("final", null, total, invoiced, scope);             // 400
stageLineDescription("final", null, total, scope);                 // "Final balance on $12,000.00 contract"

invoiced += 400;                                                   // 12000
stageProblem("final", null, total, invoiced, scope);
// "The full $12,000.00 contract has already been invoiced."
```

| Stage              | Basis                 | Bills     | Invoiced to date |
| ------------------ | --------------------- | --------: | ---------------: |
| Deposit            | 30%                   | $3,600    | $3,600           |
| Progress payment 1 | lines `[100, 50, 0]`  | $4,600    | $8,200           |
| Progress payment 2 | lines `[100, 100, 50]`| $3,400    | $11,600          |
| Final              | –                     | $400      | $12,000          |

### Change orders

An approved change order is just another scope line. Rebuild the contract with
it included and the total rises; the deposit already sent is untouched, and the
final invoice bills the difference.

```ts
const amended = contractFromLineItems([
  ...originalLines,
  { section: "Approved change orders", description: "Paint the hallway closet", amount: "800" },
]);
amended.total;                                                     // 12800
stageDueAmount("final", null, amended.total, 11600, amended.scope);// 1200   (was 400 before the change order)
stageLineDescription("final", null, amended.total, amended.scope); // "Final balance on $12,800.00 contract"
```

### Guards

No stage ever bills past the remaining balance, and `stageProblem` explains
before you create the invoice:

```ts
stageProblem("deposit", { type: "amount", value: 13000 }, total, 0, scope);
// "That is more than the $12,000.00 left to bill on this contract."
stageDueAmount("deposit", { type: "amount", value: 13000 }, total, 0, scope);
// 12000  (capped)

stageProblem("deposit", { type: "percent", value: 30 }, 0, 0, []);
// "This job has no total yet. Enter the job total, or add priced line items to the job, or send a standard invoice."
```

## API

All functions are pure and synchronous. `scope` is the array returned by
`contractFromLineItems`; `previouslyInvoiced` is the sum of what earlier sent
invoices on the same contract billed (your app decides what counts as sent).

| Export | Purpose |
| --- | --- |
| `contractFromLineItems(items)` | Normalise job lines into `{ scope, total }`, amounts rounded to cents. |
| `suggestedPercents(scope)` | Starting per-line percents from each line's `status`. |
| `completedToDate(scope, percents)` | Dollar value of work done under a per-line basis. |
| `overallPercent(scope, percents, contractTotal)` | Price-weighted percent complete, one decimal. |
| `stageDueAmount(stage, basis, contractTotal, previouslyInvoiced, scope?)` | What the stage bills before tax, capped at the remaining balance. |
| `stageProblem(stage, basis, contractTotal, previouslyInvoiced, scope?)` | A plain-language reason the stage can't be created, or `null`. |
| `stageLineDescription(stage, basis, contractTotal, scope?, stageNumber?)` | The one billable line's text, as it prints. |
| `stageDisplayName(stage, stageNumber?)` | `"Deposit"`, `"Progress payment 2"`, `"Final invoice"`, or `"Invoice"`. |
| `isInvoiceStage(value)` / `isStaged(stage)` | Type guards. |
| `INVOICE_STAGES`, `INVOICE_STAGE_LABELS` | The stage names and their labels. |
| `stageBasisSchema`, `contractScopeLineSchema` | zod schemas for validating a basis or a scope line at the edge. |
| `InvoiceStage`, `StageBasis`, `ContractScopeLine` | Types. |

A `StageBasis` is one of:

```ts
{ type: "amount",  value: number }          // dollars
{ type: "percent", value: number }          // percent of the contract total
{ type: "lines",   percents: number[] }     // percent complete per scope line, 0–100, in scope order
```

## License

MIT
