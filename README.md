# Bid Pipeline

A web app for tracking site work bids, with logins for your whole team. It is hosted free on GitHub Pages, and Supabase stores the logins, data and files.

## Who can do what

| Role | What they can do |
|---|---|
| **Admin** (precon manager) | Everything. Create, edit and delete bids. Assign lead and supporting estimators. Manage the estimator, client, vendor and scope lists, scope templates and team roles, and customize the board view. |
| **Estimator** | Sees their own dashboard and only the bids assigned to them, as lead or support. On those bids they can change anything except who's assigned, sign off scopes with their initials, manage vendor quotes, and upload and download files. |
| **Project manager** | The Jobs side only: job budgets, logging costs and installed quantities, cost imports, and job reports. Can create jobs. Can't see bids. |
| **Board member** | Read-only board dashboard (win rate, awards, pipeline trends) and pipeline. |
| **No access yet** | New logins start here until an admin sets their role. |

These rules are enforced by the database (row-level security), not just hidden in the page. An estimator can't reach other people's bids even with technical know-how.

## Files

```
index.html            the page
styles.css            the look
app.js                the app
config.js             ← your Supabase URL and key, company name, colors and logo
img/                  company logo files
templates/            copies of the Excel import templates (the app has them built in)
supabase/schema.sql   database tables, security rules, file storage
supabase/update-2-scopes.sql   one-time update for scope templates and sign-offs
supabase/update-3-gc-proposals.sql   one-time update for per-GC proposal amounts
supabase/update-4-vendor-scopes.sql   one-time update for vendor types and scopes
supabase/update-5-addenda-revisions.sql   one-time update for addendum and revision logs
supabase/update-6-project-types-units.sql   one-time update for units and new project types
supabase/update-7-archive.sql   one-time update for archiving bids
supabase/update-8-bid-statuses.sql   one-time update for the new bid statuses
supabase/update-9-jobs.sql   one-time update for the project manager side (jobs, budgets, costs)
supabase/update-10-job-rates.sql   one-time update for job overhead/markup defaults
supabase/update-11-estimator-log.sql   one-time update for the estimator log
supabase/update-12-supersede.sql   one-time update for superseding projects
supabase/update-13-codebooks.sql   one-time update for estimating codebooks
```

> **Already set up before these updates?** Run each `supabase/update-*.sql` file you haven't run yet, once, in number order, in the SQL Editor. New installs only need `schema.sql`.

---

## Setup (about 20 minutes)

### 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Pick a name, a strong database password, and the region closest to you.
2. When it finishes, open **SQL Editor → New query**, paste in the whole contents of `supabase/schema.sql`, and click **Run**. You should see "Success".

### 2. Lock down sign-ups
Only people you add should be able to log in.
1. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Keep Email enabled.
2. You'll set the Site URL in step 5, once you have your GitHub Pages address.

### 3. Create your admin login
1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a password, and check **Auto Confirm User**.
3. **The first account created becomes Admin automatically.**

If that ever doesn't happen, run this in the SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'you@yourcompany.com';
```

### 4. Connect the app
1. In Supabase, go to **Project Settings → API** (sometimes shown as **API Keys**).
2. Copy the **Project URL** and the **anon / public** key (it may be called the *publishable* key).
3. Paste both into `config.js`, along with your company name.

> The anon key is designed to be public. The security rules in the database protect your data. **Never** paste the `service_role` / secret key anywhere in this project.

### 5. Put it on GitHub Pages
1. Create a new repository on [github.com](https://github.com), for example `bid-pipeline`.
2. Click **Add file → Upload files** and drag in everything from this folder, including the `supabase` folder. Then commit.
3. Go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, then **main** and **/(root)**. Save.
4. After a minute your app is live at `https://YOUR-USERNAME.github.io/bid-pipeline/`.
5. Back in Supabase, go to **Authentication → URL Configuration**:
   - Set **Site URL** to that GitHub Pages address.
   - Add the same address under **Redirect URLs**.

   Password-reset and invite emails need this to land in the right place.

Open the address, sign in, and you're in as Admin.

### 6. Add your team
1. In the app, add each estimator on the **Estimators** page, using the email they'll log in with.
2. In Supabase, go to **Authentication → Users → Add user**, then either:
   - **Send invitation**: they get an email and set their own password.
   - **Create new user**: you set a password and give it to them.
3. In the app, open **Team & logins** and set each person's role.
   - Estimators whose email matches an estimator record are linked automatically.
   - Otherwise, pick their record in the "Linked estimator" column, or click **Create record**.

Estimators only see bids where they're the lead or a supporting estimator.

---

## Signing in
- **Remember me** checked: you stay signed in on that computer until you sign out.
- **Remember me** unchecked: you're signed out when the browser closes. Good for shared computers.
- **Forgot password?** emails a reset link.

## Scopes and sign-offs
- The **Scopes** page (admin only) holds your company's scope list and templates. It starts with a site work list you can edit.
- On a bid, apply a template, pick scopes from the list, or type a custom one. Each scope can be assigned to a specific estimator on the bid.
- When a scope's takeoff is done, the estimator clicks **Sign off** and confirms their initials. The app records their name and the time, and saves right away. The database only accepts a sign-off under the signed-in person's own login.
- The signer or an admin can **Reopen** a signed-off scope.

## Files and quotes
- Files are stored privately in Supabase Storage. Only people who can see a bid can download its files.
- Any file type works: PDF, Excel, images, and so on.
- The free plan allows 50 MB per file and 1 GB total. Change the per-file limit under **Storage → Settings**.
- Deleting a bid also deletes its files.

## Finding things
- **Pipeline views:** Cards, List (sortable columns) and Calendar (bid due dates, site walks, RFI deadlines and quote need-by dates). Your view, sort and filters are remembered on each computer.
- **Filters:** estimator, GC, due date range, bid value, project type, bid type, and "needs attention" flags like open addenda or outstanding quotes.
- **Search** matches project names, GCs and their contacts, estimators, scopes, vendors, addenda and notes.
- **Quick search:** press **Ctrl+K** (Cmd+K on Mac) anywhere, or **/**, to jump to any bid, GC, vendor or page.

## Jobs (project manager side)
- **Setting up a job:** click **Create job** on an awarded bid, **+ New job**, or **Import budget** (bid item or cost code template).
- **Budget lines** are entered as **bid prices** by labor, equipment, materials, subcontract and other. The job's overhead % and markup % (or a line's own) are taken back out to get the **budget cost**: cost = bid price ÷ (1 + overhead %) ÷ (1 + markup %). Costs are tracked against the budget cost.
- **Logging:** log costs per line or for a whole day at once (**+ Log costs**), or bulk-import from payroll/accounting (**Import costs**). Log **quantity installed** — it drives % complete.
- **The numbers:** earned = budget × % complete; cost variance = earned − actual; projected cost uses the budget rate for remaining work until a line is 10% complete, then the actual cost per unit so far; projected profit = contract − projected cost. Lump-sum lines without a quantity use a PM-entered % complete.
- **Burn rate:** cost in the last 7 days, average weekly cost over 4 weeks, earned per $1 spent, and weeks of projected cost left at that pace.

## Superseding a project
When the same project comes back under a new name or with new details, open the bid and click **↻ Supersede**. Change whatever is new (name, location, type, units, dates, status, GCs) and add a reason. The bid keeps its quotes, files, scopes and estimator log; it shows **Superseded** with the date, the original entry date and a history of every change, and searching the old name still finds it. Needs `supabase/update-12-supersede.sql`.

## Estimator log
Every bid has an **Estimator log** under Scope takeoff. Estimators on the bid (and admins) add dated notes — site visits, takeoff notes, assumptions, clarifications, questions/RFIs, risks, pricing, calls — for the whole project or one scope, with photos or files attached. Notes save right away. You can edit, pin or delete your own notes; admins can manage any. Each scope row shows how many notes it has. When an awarded bid becomes a job, the notes show up read-only on the job's **Estimator notes** tab for the PM. Needs `supabase/update-11-estimator-log.sql`.

## Codebooks (estimating)
**Codebooks** holds the price book estimates are built from. Admins edit; estimators can view and export. Needs `supabase/update-13-codebooks.sql`.
- **Materials:** code, description, category, cost type (material, subcontract, trucking, other), unit, unit cost, vendor, waste %, taxable and price date. Prices older than 6 months show in amber.
- **Labor:** base wage, fringe $/hr and burden %. These roll up to a loaded $/hr (base × (1 + burden) + fringe), plus an overtime rate.
- **Equipment:** owned or rented, rate $/hr plus operating $/hr (fuel, repairs, wear).
- **Crews:** built from labor and equipment. Crew size, labor $/hr, equipment $/hr and crew $/hr are always calculated from the current rates, so a wage or rate change flows into every crew.
- **Mass update prices:** tick items, or use everything shown after a search or filter, then raise or lower by %, add or subtract an amount, or set a value. Round to the cent, dime, quarter or dollar. You see every old → new price before anything is saved. Add a note (e.g. "MM 2027 increase"); it goes into each item's **price history** along with manual edits and imports.
- **Import from Excel:** any layout works.
  - Pick the sheet and the row the headings are on, then match your columns to the codebook fields.
  - The app guesses the matches and remembers them for next time.
  - Items with the same code are updated instead of duplicated. Blank cells never erase data.
  - You can apply one vendor to a whole supplier price list.
- **Export to Excel:** writes all four codebooks in the same layout the import reads. You can export, edit prices in Excel, and import the file back.

## Calculators
**Cut / fill from plans:** upload the grading sheet (PDF or image), set the scale by clicking two points a known distance apart, draw the perimeter, then trace the existing and proposed contours (right-click, double-click or Enter ends a line; plus flat pads and spot elevations) and give each an elevation — the next contour's elevation fills in automatically. Calculate gives rough cut, fill, import/export (fill × (1 + shrink), the same as AGTEK’s Comp/Ratio), topsoil strip and truck loads, with a cut/fill map on the plan. Lines are remembered in that browser; re-upload the same plan to see them.
**3D view:** after you calculate, **🧊 3D view** shows the proposed surface coloured by cut (red) and fill (blue) with the existing ground as a wire grid over it. Drag to turn, right-drag or Shift-drag to move, scroll to zoom; switch between Both / Proposed / Existing and change the vertical exaggeration.

**Vectorize (PDF plans):** on a PDF sheet, click **⚡ Vectorize this sheet**. It reads the line work out of the PDF and groups it by CAD layer (when the PDF kept its layers) or by line style (colour, weight, dashed). Hover a group to see it on the sheet, then send the whole group to **EX** (existing) or **PR** (proposed) — or use **Pick** to click lines (Shift-drag to box-select) and send just those. Contour labels printed on the sheet are read and matched to the nearest line, so most contours come in with their elevation. Anything still missing one shows in red — **Next line missing an elevation** walks you through them (type the elevation, Enter, it jumps to the next). The **Elevation** tool lets you click any line to fix its elevation. Scanned (image-only) sheets have no line work — trace those by hand; you can always mix vectorized and hand-traced lines.

**Plan sets:** each sheet gets its own scale (use Scale on each sheet you work on). Sheets stack on top of each other by default, and everything you draw (perimeter, contours, pads, spots) sits in front of whichever sheet you're looking at. To line sheets up exactly — match lines, or an existing-conditions sheet and a grading sheet — pick the sheet and use **Align**: click a point on it, click where that point is on another sheet (other lined-up sheets show through underneath), and optionally a second pair to set the rotation. Anything traced on a sheet moves with it if you rescale or realign it. Align also works against imported surfaces, so a plan sheet can be lined up with a LandXML TIN.
You can also **Import surface** instead of tracing: LandXML (Civil 3D, Trimble Business Center, AGTEK — TIN faces, or just points / breaklines / contours, which the app triangulates) and ASCII DXF files — 3D faces become a TIN, contour polylines with an elevation become contour lines, and points become spots. Pick which surface or layer is existing and which is proposed. Surfaces come in at real coordinates (feet; metric files are converted); use Align to line a plan sheet up with them. Draw a perimeter, or leave it off to use where the surfaces overlap.

Everyone except board viewers gets a **Calculators** tab: pipe bedding and stone backfill (with a live trench section drawing), underground detention/retention (ADS StormTech chambers or round pipe, with separate stone under and around the system, storage, fabric and a live section), precast manholes (base, risers, cone or flat top and adjusting rings from the rim and inverts, with a live section drawing and an order list), trench excavation, pipe slope and fall, cut/fill volume, average end area, trucking and haul, stone/GAB by area, asphalt tonnage, concrete, tons ⇄ cubic yards, silt fence, seeding and mulch, slope and unit converters, crew unit cost, and cost ⇄ bid price. Each one shows its math. Admins can build a company **Pipe library** (name, nominal size, OD and optional ID) — those pipes show up at the top of the pipe list in the pipe bedding and manhole calculators. Last inputs are remembered on each computer. Admins set the company's material weights (tons per CY) under **Material weights**; anyone can type their own weight to override it for one calculation.

## Importing jobs from Excel
For moving existing jobs into the app. Pipeline → **Import from Excel** (admins only) → **Download import template** (it's built into the app), fill in one row per job, and upload it. You get a preview before anything is saved. Importing only **adds** jobs that aren't already in the app — nothing existing is changed or removed, and duplicates are skipped. New bids are still created with **+ New bid**. Existing spreadsheets with their own column headings usually work too.

## Importing clients, GCs and vendors
The Clients & GCs and Vendors pages each have **Import from Excel** (admins only) with their own built-in template. Same rules as bids: preview first, only adds what isn't there, duplicates are skipped. For clients, one row per contact; new contacts for a company already in the app are added to it. For vendors, list the scopes each one quotes so the vendor picker can suggest them.

## Branding
Colors and logo are set in `config.js` under `brand`. Change `primary` (buttons, highlights, progress) or `topBar` (menu bar) to any hex color. To swap the logo, upload new images into `img/` with the same names, or point the `logo` / `loginLogo` settings at new files. Status colors (green for awarded, red for past due, amber for in progress) stay fixed so warnings are always easy to spot.

## Making changes later
Edit a file on GitHub (click it, then the pencil icon) and commit. The live site updates within a minute or two.

## On the list for the future
- **Estimating, next phases:**
  - An estimate on each bid: bid items → activities → crews, materials, subs and trucking, with production rates, cost roll-ups, and a unit price override.
  - Activity and bid item codebooks.
  - A quotes folder that compares vendor quotes line by line and pushes the low price into the estimate.
  - Markup, overhead, bond and retainage.
  - A proposal built from the estimate.
- **AI takeoff — the whole site** — upload the plan set and have the app do the full takeoff for the estimator to review: **dirtwork** (cut/fill, import/export, strip, pads), **underground** (storm, sanitary and water pipe LF by size and material, structures with inverts and depths, fittings, bedding, trench), **erosion control** (silt fence, inlet protection, construction entrance, check dams, matting, seeding), **demo** (pavement, concrete, curb, structures, clearing, utilities), plus paving, curb and concrete. Every quantity links back to where it was found on the sheet.
- Pull contour lines straight out of vector PDFs (label elevations only).
- Save takeoffs to a bid and share them with the team.
- Read Agtek .tn3 / Trimble .ttm surfaces and DWG files.

## Good to know
- **Free plan pausing:** Supabase pauses free projects after about a week with no activity. Normal daily use prevents it. If it pauses, click **Restore** in the dashboard. The Pro plan ($25/mo) never pauses and adds daily backups.
- **Public repository is fine:** nothing secret is in these files. GitHub Pages on a private repository needs a paid GitHub plan.
- **Re-running `schema.sql`:** safe to do. It keeps your data and refreshes the security rules.
