# Bid Pipeline

A web app for tracking site work bids, with logins for your whole team. It is hosted free on GitHub Pages, and Supabase stores the logins, data and files.

## Who can do what

| Role | What they can do by default |
|---|---|
| **Admin** | Everything, plus logins, roles, access and company settings. |
| **Executive / owner** | Sees everything (dashboard, all bids, estimates, codebooks, jobs, accounting, contacts) and changes nothing. |
| **Estimator** | Their own dashboard and only the bids assigned to them (lead or support), with estimates on those bids. Codebooks and contacts are read-only. On their bids they can change anything except who's assigned, sign off scopes, manage vendor quotes, and upload and download files. |
| **Project manager** | Jobs (budgets, cost logs, production) and Accounting (billing). Can't see bids. |
| **Accounting / bookkeeper** | The Accounting tab only: WIP, billing, cost imports and account IDs. |
| **Board member** | Read-only board dashboard, pipeline and estimates. |
| **No access yet** | New logins start here until an admin picks their role. |

Anyone's access can be adjusted area by area on **Team → People & access → Edit access…**. For example, you can give an estimator view-only Jobs, or show them all bids instead of only their assigned ones. **Team → Access chart** shows every role's defaults and who has custom access. Needs `supabase/update-18-team-access.sql`.

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
supabase/update-14-estimates.sql   one-time update for estimates and activity / bid item templates
supabase/update-15-quote-lines.sql   one-time update for line-item vendor quotes
supabase/update-22-estimate-revisions.sql   saved copies of estimates (revisions)
supabase/update-16-estimate-sections.sql   one-time update for master/section templates and starting estimates from the Estimates page
supabase/update-17-accounting.sql          one-time update for the Accounting tab: bookkeeper role, pay apps, account IDs, change orders, cost import keys
supabase/update-18-team-access.sql         one-time update for Team: executive role, title/phone, per-person access (run after update-17)
supabase/update-19-help-developer.sql      one-time update for Help feedback and the developer account (run after update-18)
supabase/update-20-dev-usage.sql           one-time update for the Developer tab's storage and capacity panel (run after update-19)
supabase/update-21-break-room.sql          one-time update for the Break room: profiles, trophies, game scores (run after update-20)
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
3. In the app, open **Team → People & access** and set each person's role (and fine-tune their access if needed).
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

## Break room (everyone)
A tab for morale: profiles, trophies and a few site-work games. Needs `supabase/update-21-break-room.sql`.
- **My profile:** each person picks a hard hat color, an avatar, a background, a tagline and a few facts (hometown, years in the trade, favorite machine, coffee order). They can also fix their own name, title and phone. Their avatar shows in the top bar. People can never change their own role or access.
- **The crew:** everyone's profile card, with a link to their trophy shelf.
- **Trophy room:** a wall of shelves. Each trophy has bronze, silver and gold tiers, and grey ones aren't earned yet. Click one to see what the next tier takes. View your own shelf, anyone else's, or the **company case**.
  - Work trophies come from real activity: bids won, dollars won, biggest win, bids submitted, scopes signed off, estimates built, log notes, jobs managed and completed, costs and quantities logged, pay apps sent, bugs reported that got fixed, ideas that got built, and time on the app.
  - Game trophies come from the Break room games. A couple are secret.
  - The database only shares counts, so the room works for everyone without exposing bids people can't see.
- **Games,** each with an office high-score board:
  - **Daily trivia:** one site-work question a day, the same for everyone, with streaks. Admins can add their own questions (company history, inside jokes).
  - **Guess the quantity:** five sketches with dimensions, 30 seconds each, no calculator. Everyone gets the same set each day; replays are practice.
  - **Pipe Dream:** turn pipe pieces to connect the manhole to the outfall before the storm. Levels get bigger and faster.
  - **Dirt Mover:** hidden. Type **dig** anywhere in the app (not in a text box) to open it. Swing the excavator, load trucks, and don't dig the layer with the utility line in it. Once someone finds it, it shows on their Games page.
  - **Push Crew:** also hidden. Type **push** anywhere in the app (not in a text box). Trucks back up to the haul road and dump; drive the dozer into a pile to push it. Pushed down the lot it slides until it lands, so the lot fills from the bottom up. A truck that can't dump is a strike (three and you're out, one is handed back for each lot you fill), and each lot has a shift clock. Lots grow 5×5, 10×10, 15×15 and the trucks come faster. Score is trucks handled; once found it shows as a card in the Break room, with its own trophy.
- **Loading screen:** a small bulldozer pushing dirt replaces the spinner.

## Help and feedback (everyone)
The **Help** tab is there for every login. Needs `supabase/update-19-help-developer.sql` for feedback.
- **Tutorials:** step-by-step guides for each part of the app. People only see guides for the areas they can open. They can search, tick guides off as they learn them, and jump straight to the page a guide is about.
- **Send feedback:** report a bug, suggest an idea or ask a question. It records which page they were on, their browser and screen size.
- **My feedback:** everything a person has sent, with its status and the developer's reply. They can withdraw an item while it's still New.

## Developer tab (developer login only)
One login can be flagged as the developer. That login keeps its normal role and gets a **Developer** tab nobody else sees.
- **Turning it on:** in Supabase's SQL Editor run `update public.profiles set is_dev = true where email = 'you@yourcompany.com';`. The app can't set this flag, and the database blocks admins from giving it to themselves.
- **Feedback inbox:** everything people send, with counts of new items, open bugs and open ideas. Filter by status, type and area, search, sort by priority, or group by area. Open an item to set its status and priority (P1–P3), keep private notes, and write a reply the sender sees. Export to CSV.
- **System tests:** **Run tests** opens a window and steps through about 50 checks:
  - the connection, live updates, file storage and a save/delete test;
  - every database table and each update's columns, naming the SQL file to run if one is missing;
  - the security functions, including that the app's access rules match the database's;
  - the estimating, rate builder, billing and job math against known answers;
  - data problems: orphaned job lines and costs, duplicate or missing job numbers, crews with removed members, estimator logins that aren't linked, people waiting for access.

  Problems are listed first with what to do about each. **Copy report** puts the whole result on the clipboard. The last run is remembered on that computer.
- **Storage & capacity:** how much of your Supabase plan is used. Needs `supabase/update-20-dev-usage.sql`.
  - Meters for database space, file storage and active logins against the plan's limits (Free, Pro, or custom numbers). They turn amber at 70% and red at 90%.
  - How fast each is filling and roughly when it would be full, from a snapshot saved each day you open the page.
  - Every table by size, and the largest uploaded files with the bid they belong to.
  - The system tests also warn when the database or file storage is getting full.
  - Data transfer ("egress") can't be measured from inside the app; see the Usage page in Supabase.
- **App info:** build date, database, row counts and people by role.

## Accounting (admins, PMs and the bookkeeper)
Connects the app to any accounting software with Excel or CSV files: budgets go out, actual costs come in, and pay apps become invoices. Needs `supabase/update-17-accounting.sql`.
- **Bookkeeper login:** give someone the **Accounting / bookkeeper** role on Team. They see only the Accounting tab. They can read jobs, import costs, bill, and keep account IDs, but can't change bids, estimates or budgets.
- **Overview (WIP):** for every job, shows contract (including change orders), cost to date, projected cost, % complete (cost ÷ projected cost), earned revenue, billed to date, **over or under billing**, retainage held and projected gross profit. **Export WIP schedule** gives the report bonding companies and accountants ask for.
- **Billing:** progress billing in the standard application-for-payment layout.
  - Each pay app bills from the job's schedule of values: this period's quantity (or % for lump sums), stored materials, and retainage % (it can hold retainage on stored materials, or release it all on the final app).
  - It shows contract to date, completed & stored, retainage, less previous certificates and the current payment due.
  - **Fill from field quantities** pulls the quantities logged on the job during the period.
  - Status goes Draft → Submitted → Approved → Paid; drafts are the only ones you can edit.
  - **Print / PDF** gives the application with its continuation sheet.
  - **Export invoice** gives one row per billed line, plus a retainage line, in the column layout you set, so the total matches the payment due.
  - **+ Change order** adds a CO line to the budget and the schedule of values.
- **Job budgets:** **Load from estimate** turns each bid item into a budget line:
  - labor, equipment, materials (with tax), subcontract, and other (trucking plus its share of indirects);
  - contract value = the bid price, so billing ties to the bid to the penny.

  Awarded bids that become jobs do this automatically. **Export** the budget one row per line, or one row per cost type for programs that want cost-type codes.
- **Import costs:** one job cost detail report from your accounting software covers every job.
  - Pick the columns (the app guesses them and remembers your choices) and map each cost-type value (L, E, M…) to a type.
  - Rows are matched to jobs by job number and to lines by cost code. Codes that aren't on the job can be posted to the job without a line.
  - Every row gets an import key, so re-importing the same or an overlapping report never doubles costs.
- **Lists & codes:**
  - **Account IDs** for customers and vendors (typed, or imported from your accounting software's list by matching names), plus list exports.
  - The company **cost code** list (import, export; budgets flag codes not on it).
  - **Cost type codes**, and the default retainage %.
- **Export columns:** budget, invoice and WIP exports each have a **Columns…** editor. Rename headings to exactly what your accounting software's import expects, reorder or drop columns, and choose Excel or CSV. The QuickBooks Online preset is a starting point, so check it against the sample import file in your QuickBooks.

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

## Top bar
**Dashboard · Pipeline · Estimates · Jobs · Accounting · Contacts · Calculators · Team · Break room · Help** (plus **Developer** for the developer login). Related pages share one tab, with sub-tabs inside it:
- **Contacts:** Clients & GCs, and Vendors & subs.
- **Estimates:** Estimates, Master templates, Codebooks, Scopes & templates (admins) and Bid settings (admins).
- **Team:** People & access, Estimators, Project managers, Accounting & executives, and the Access chart.

When the bar is too narrow, the last tabs fold into a **More** menu.

## Rate builder (labor & equipment)
Labor and equipment in the codebook can be **built from their costs** instead of typed. New items start with the builder on. Untick it to type a rate yourself.
- **Labor:** enter the base wage, pick a workers comp class and an optional union fringe package, and add craft fringes and add-ons (truck, phone, tools, PPE) in $/hr.
  - Paid time off, payroll taxes (with yearly wage caps), workers comp and company benefits are annual costs. They are divided by hours actually worked (paid hours minus time off).
  - The result is written into burden % and fringe $/hr, so loaded rates, crews and the overtime premium work as before.
- **Owned equipment:**
  - Ownership: depreciation (price − salvage − tires) ÷ life hours, plus interest, insurance, property tax and storage as a % a year of the average value.
  - Operating: lifetime repairs %, tires or undercarriage ÷ their life, fuel burn × fuel price, lube % of fuel, and wear parts.
- **Rented equipment:** monthly, weekly or daily rate ÷ the hours in that period, plus damage waiver and fees %, delivery and pickup spread over the rental length, and fuel and repairs. It shows which rate is cheapest per hour.
- **Rate sheet** (Estimates → Bid settings) holds:
  - fuel prices, paid hours and time off;
  - payroll taxes and insurance with wage caps;
  - workers comp classes ($ per $100 of payroll);
  - company benefits ($/yr), union fringe packages, and equipment % defaults.

  Saving it reprices every built rate and logs the change in price history. The starting numbers are placeholders, so check them against your payroll provider and insurance policy.
- **Fuel on an estimate:** Markup & totals → Fuel price. Set diesel or gas $/gal for that bid. Every machine's fuel and lube (in crews or on their own) is repriced, and it shows the gallons and the $ change. Leave it blank to use the price each rate was built with.
- Mass update skips the calculated fields on built items. To change those, change the item's costs or the rate sheet.

## Bid settings (Estimates → Bid settings, admins)
The defaults every new estimate starts with. Each estimate keeps its own copy, so changing a setting never moves a bid that's already priced.
- **Markup & overhead:**
  - **Simple:** overhead % and markup % on bid cost.
  - **By cost type:** separate overhead % and markup % for labor, equipment, material (+ tax), subs, trucking, other and indirects.
  - Choose whether markup is figured on cost + overhead (compounded) or both on cost.
  - Bond %, sales tax % and retainage %.
  - Default spreads for indirects and markup.
- **Indirect costs:** the starting list of indirects (superintendent, trucks, mobilization, small tools, temporary facilities, insurance…), each priced per week, per month, per work day, per man-hour, as a lump sum, as % of labor or as % of direct cost. Also the default number of crews working at once.
- **Work schedules & overtime:**
  - Schedules like 5×8, 5×10, 4×10 and 6×10, with hours for each day of the week.
  - Overtime after X hours a week and/or a day, at a rate you set (1.5×).
  - Double time after X hours a day, Saturday as all overtime, Sunday as all double time.
  - Pick one schedule as the default for new estimates.

## Estimates
**Getting started**
- **Estimates tab:** lists every estimate (project, GC, due date, status, lead, cost, bid total, margin) and the **Master templates**.
- **+ New estimate:** pick a bid from the pipeline, or type a new project name, GC and due date. The bid record is created for you, with you as lead estimator. Then start from:
  - a master template,
  - the bid's scopes, which become sections,
  - a blank estimate,
  - or a copy of another estimate.
- **From a bid:** the **Start estimate / Open estimate** button in the bid window still works.
- Needs `supabase/update-14-estimates.sql`, plus `update-16-estimate-sections.sql` for templates and new projects.

**Structure:** Sections (scopes) → Bid items → Activities → Costs.

**Build tab (left side):** an outline that works like a spreadsheet.
- Sections, bid items and activities each expand and collapse (▸ / ▾). **Show Sections / Bid items / Everything** jumps to a level.
- Type the code, description, quantity and unit right in the grid. **Enter** moves down a column.
- Right-click a row, or use **⋯**, to add, duplicate, move, delete, make an alternate, or save it as a template.
- Codes number themselves (400 / 410 / 410.10) and you can type over them. **Renumber** tidies everything.

**Build tab (right side):** shows what you clicked.
- **Section:** name, notes, totals and its bid items.
- **Bid item:** quantity, section, unit price override, alternate, totals and its activities.
- **Activity:** the cost sheet. The crew row comes first, then labor, equipment, materials, subs, trucking and other costs. Type a code or name in the bottom row to add from the codebook.
- Each block collapses, and **Hide panel** gives the outline the full width.

**Schedule & indirects tab**
- **Schedule:** pick the work schedule. Its hours per day drive units/day and crew-day production. Its overtime rule adds the overtime premium to labor (base wage × burden × the OT rate above straight time, on the overtime share of hours).
- **Duration:** crew days ÷ crews working at once. Type over it if you know the schedule.
- **Indirect lines:** totaled from the duration, or from labor or direct cost. Type over any line's quantity.
- **Getting indirects into the price:** choose one of these:
  - Spread over every bid item by cost.
  - Spread only over bid items with sub work, weighted by their sub cost.
  - Split between self-perform and subs:
    - Set the self-perform share (e.g. 80 / 20). Each side is spread over its own items by that side's cost.
    - Leave the share blank to split by cost, which gives the same result as spreading over everything.
    - A breakdown shows each side's direct cost, indirects, and the % they add.
  - Carried only by items you pick.
  - Shown as its own lump-sum line (e.g. "General conditions") on the proposal.

**Markup & totals tab**
- **Modes:** Simple (overhead + markup on bid cost) or By cost type, with the compounding option, bond, tax and retainage.
- **Load company defaults** pulls in the Bid settings defaults.
- **Getting markup into unit prices:**
  - each item carries its own share,
  - only the items you pick carry it,
  - or you adjust items by hand for an unbalanced bid. An "out of balance" check shows whether the adjustments still add up to $0.

**Bid item setup tab:** every bid item in one spreadsheet, grouped by section.
- **Editing:** type the item #, description, quantity, unit, alternate and price override in place. Enter moves down a column.
- **Units of measure:** type them any way, for example ls → LS, ea or each → EA, ft → LF, tons → TON, cy → CY, acres → AC. This works everywhere a unit is entered.
- **Fast entry:** **Tab** goes Description → Qty → Unit, then drops to the next row, or to the empty "new bid item" line at the end of the section, so you can keep typing items without touching the mouse. Shift+Tab goes back.
- **Adding:** start typing in "+ New bid item…" to add one. Delete with ×; items that have activities take two clicks.
- **Paste from Excel:** copy rows with Item #, Description, Qty and Unit columns and paste them into a cell. The rows fill down, and new bid items are created as needed.

**Look-alike check:**
- **What it catches:** when a bid item you typed by hand (no activities yet) is close to one in the bid item codebook, for example "Silt fence" ≈ "Silt fence (Type C)" or "Const entrance" ≈ "Construction entrance".
- **What happens:** a blue banner says so. When you click **✓ Done — review** or leave the tab, you get "These look like codebook bid items". Switch each one to the codebook version (its activities, crews and costs come in; your quantity stays), or keep it as typed.
- **Sizes:** sizes have to match, so 15″ RCP won't be offered 18″ RCP.
- **Keep mine:** once you keep one as typed, it won't ask again unless you change the description.

**When a bid item's quantity changes:**
- Activities with a blank quantity follow the bid item automatically.
- Activities that have their own quantity get a prompt, **"Apply new quantities to activities?"**. You can scale them by the same ratio (400 → 500 LF scales them ×1.25), or match the bid item and keep following it. Untick any activity to leave it alone.
- In the Build tab the prompt comes up right away. In Bid item setup, a banner collects your changes and the prompt comes up when you click it or leave the tab.

**🔍 Search codebook**
- **Where:** a button on the outline toolbar, in a section ("Search bid item codebook"), in a bid item ("Search activity codebook"), and in an activity's cost sheet.
- **What it searches:** opens the codebook with tabs for Bid items, Activities, Section templates, Materials, Labor, Equipment and Crews. Search by code, description, category or vendor, and filter by category.
- **Where picks land:** the window tells you before you add.
  - Bid items go into the selected section.
  - Activities go into the selected bid item.
  - Labor, equipment and materials go into the open activity.
  - A crew becomes the activity's crew.
  - Section templates come in as new sections.
- **Adding:** pick several rows and click Add, double-click one row to add it right away, or press Enter when the search narrows to a single result. Everything comes in at today's codebook prices.

**📖 From codebook** (in the Bid item and Activity panel headers)
- **On a bid item:** pick a codebook bid item to fill this one. You get its description and unit if they're blank, plus its activities, added after any already there.
- **On an activity:** pick a codebook activity to fill this one with its crew, production and costs, replacing what's there now.
- **The list:** grouped by category, with search.

**Templates**
- **Save as master template** (admins) saves the whole estimate, including its settings: work schedule, crews at once, markup mode and rates, bond, tax, retainage, the indirect list, both spread choices and which items carry the markup. Every estimate started from it begins with exactly those settings. Only the job duration is recalculated for each job.
- **Make these the company defaults** (admins), on the Markup and Schedule & indirects tabs, copies an estimate's setup to Bid settings so every new estimate starts that way, with or without a template. **Save as section template** on any section saves one scope.
- Each time you save, you choose whether to clear the quantities or keep them as "typical".
- Templates are always priced at the codebook rates on the day an estimate is started from them.
- Starting from a master template opens **quantity entry**: blank bid items are highlighted so you can punch in your takeoff. **Remove items left blank** drops the ones you don't need.
- Add a section template to any estimate with **+ Section from template**. Edit templates in the same builder from **Estimates → Master templates**.
- Estimates made before sections existed are converted automatically: each bid item goes into a section named after its old Scope field, or "General".

- **Bid items** have a quantity and unit and are built from **activities**. Use **Alternate** to price an item but keep it out of the base bid. Enter a **unit price override** to set an item's price yourself.
- **Activities** have a quantity (blank means the bid item's quantity), a **crew** and a **production rate**. The rate can be entered as units/hr, hrs/unit, units/shift, units/day, units/week, or as a fixed total of crew hours, shifts, days or weeks. Shift modes have their own shift length (blank means the schedule's hours per day), and week modes use the schedule's weekly hours. Together these give the crew hours, days and man-hours. Crew $/hr × hours gives the crew's labor and equipment cost. Any cost line set to **per crew hr** (say, a laborer or an excavator added on its own) is multiplied by those same hours. For example, 1,000 CY at 250 CY/hr is 4 crew hours, so a $50/hr laborer costs $200. A line under the production rate shows the math.
- **Costs on an activity:** add labor, equipment or materials from the codebook (type to search), or a custom labor, equipment, material, sub, trucking or other cost.
  - Each cost is figured per unit of the activity, per crew hour, or as a total.
  - Materials can carry a waste % and sales tax.
- **Prices are copied in when you add them,** so later codebook changes don't move a bid you've already sent. When codebook prices change, **↻ Update prices** pulls in the current ones.
- **Markup & totals:** sales tax on taxable materials, overhead (on cost), profit (on cost + overhead), bond (on everything above) and retainage (shown for cash flow; it doesn't change the price). Markup is spread into unit prices, rounded to the cent. The rounding and any overrides are shown as their own line. **Send to the bid** puts the base bid total into the bid's proposal amount.
- **Proposal pricing options:** with unit prices showing every bid item, you can tick **Hide unit prices** and/or **Hide line amounts (extensions)**. Items, quantities and units still list; scope subtotals and the total base bid still show.
- **Your own Word / Excel proposal templates:** on the Proposal tab, pick a company template and click **Fill & download** to get your own file with this estimate's project, GC, bid items, prices and wording filled in. The built-in proposal is still there; use either. Needs `supabase/update-23-proposal-templates.sql`.
  - **Building a template:** in your Word (.docx) or Excel (.xlsx) file, type field names in double curly braces where the app should fill in, like `{{project}}`, `{{client}}`, `{{total}}`, `{{inclusions}}`. The full field list is in the app under **Field list**.
  - **Bid item rows:** make one table row with `{{item.code}}`, `{{item.desc}}`, `{{item.qty}}`, `{{item.unit}}`, `{{item.unit_price}}`, `{{item.amount}}`. The app repeats it for every bid item. `{{scope.name}}` / `{{scope.total}}` repeat per section and `{{alt.…}}` per alternate.
  - **Excel:** a cell holding only a number field becomes a real number, so your number formats and formulas work. Formulas in the repeated row are copied down and a SUM range ending on that row grows with it. Excel tables, conditional formatting and named ranges below a repeated row are not moved.
  - **Managing:** admins upload, rename, download and delete templates under **Manage templates** (4 MB limit; old .doc/.xls files must be saved as .docx/.xlsx first). Starter Word and Excel files are there to download.
- **Gantt schedule:** the Gantt schedule tab in an estimate draws one bar per bid item, grouped by section. Days come from each item's crew hours and your work schedule; items with no crew (subs, materials only) start at 1 day and show hatched until you type a number. Each item starts after the one above it; change **Starts** to run items side by side, and **Wait** to add a gap (negative overlaps). Set a start date to see real dates with weekends skipped. **Use N days for indirects** pushes the schedule length to Schedule & indirects. Print it or export to CSV for Excel. On the Proposal tab you can show the duration and include the chart; Word/Excel templates get `{{duration_days}}`, `{{duration_weeks}}`, `{{start_date}}` and `{{finish_date}}`.
- **Revisions:** when plans change (prelim set → stamped set), click **Revise** on the Estimates list or **Revisions** inside the estimate. Name the copy being kept ("Original — prelim plans") and the new revision ("Stamped plans"). The app keeps a locked copy of the estimate as it is, and you keep working on the same estimate as Revision 1, 2, … with the same vendor quotes. Needs `supabase/update-22-estimate-revisions.sql`.
  - **Saved copies** are read-only. Open one to look at it or export it to Excel, then **Back to the working estimate**.
  - **Make this the working estimate** brings a saved copy back. The estimate it replaces is kept as a copy first, so nothing is lost.
- **Deleting an estimate:** admins get a **Delete** button on the Estimates list. It removes the estimate and its saved copies after you type DELETE. The bid, its files and its vendor quotes stay.
- **Moving a bid item to another section:** click the **⋯** on the bid item (or right-click it) → **Move to another section**, then pick the section. Or drag the row (grab it anywhere outside the text boxes) onto a section header, or onto another bid item to land just above it. Its activities move with it and it gets the next item number in the new section.
- **Resources** totals every material, sub, trucking and extra cost, plus crew hours, across the base bid. Use it as your list for quotes.
- **Autosave:** the estimate saves itself a second after you stop typing. If someone else saved in the meantime, you get a warning and can load their version or keep yours.
- **Export to Excel:** bid items, full detail and the markup summary.
- **Quotes:** the Quotes tab is the estimate's quote folder. Needs `supabase/update-15-quote-lines.sql`.
  - **Folders:** quotes are organized in folders (Aggregates, Water, Sewer, or any name you make up). Each folder holds the estimate lines one group of vendors will price.
    - **In the codebook:** every material has a **Quote folder** field. Set it once and that material always lands in that folder. Tick several materials and use **Set quote folder…** to do many at once.
    - **⚙ Generate folders:** sorts every material, sub, trucking and other cost in the estimate into folders. It uses the codebook's quote folder, then the item's category, then the cost type (Subcontractors, Trucking, Materials). Lines already in a folder are left alone, so press it again after adding to the estimate.
    - **Move…** on any line sends it to another folder or a new one. With **Remember moves in the codebook** ticked, the material goes there on every future estimate.
    - **Where is each line?** lists every material, sub and trucking line with the folder it's in; click the folder name to jump there. A codebook line that was copied and retyped into something else (a stone line renamed to 8" DIP) counts as its own line.
    - **Update pricing in estimate:** applies the picked prices from every folder at once. **Apply this folder** does just the one you're on.
    - Quote prices replace the codebook price on this estimate only, and the "update prices from codebook" button leaves quote-priced lines alone. Tick **Also update codebook prices** to push the quoted price back into the codebook.
  - **Packages:** a package is what you send out for pricing, such as "Pipe & structures", "Stone" or "Erosion control sub". Add the estimate's materials, subs, trucking or rentals to it, then add vendors.
  - **Vendor prices:** each vendor gets a column for unit prices on each line, plus freight / other charges. Tick **Lump sum** for vendors who give one total, and **Tax incl.** when their prices include sales tax.
  - **Comparing:** the low price on each line is outlined. **Complete total** prices any line a vendor skipped at the estimate price, so totals compare fairly.
  - **Picking:** each package has a **Use** rule:
    - **Lowest price on each line** or **Highest price on each line**, across every vendor who quoted that line.
    - **One vendor's pricing** on every line (also the **Use this vendor** button on their column).
    - **Prices I pick by hand:** click the dot next to any price. Clicking a dot while a rule is on switches to by-hand and keeps what the rule had chosen.
    - Rules stay live: when a new price comes in, the picks update by themselves. Lines nobody quoted (or the chosen vendor skipped) stay at the estimate price.
    - **Use on all packages** sets every package to lowest or highest in one click.
  - **Apply picks to estimate:** puts the prices into every matching cost and tags them "Quote · Vendor". Freight is spread over that vendor's lines, and a lump sum is spread over its lines by estimate cost. Admins can also update the codebook prices, which are recorded in price history.
  - **Saving:** prices save as you type, and a quote with prices switches to Received. Quote totals show on the bid's quote list too.
- **Proposal:** the Proposal tab builds the proposal from the estimate. A live preview is on the right.
  - **Contents:** pick which GCs it goes to and how pricing shows: unit prices for every bid item (with scope subtotals), a lump sum per scope, or one lump sum. Alternates are always listed separately. Check off inclusions, exclusions and clarifications from the company library, add your own lines, and set terms, how long the price is valid, and the signer.
  - **Print / save as PDF** prints just the proposal.
  - **Mark sent** records the total, status "Sent" and the date for each GC on the bid, and sets the proposal status to Sent.
  - **Edit library** (admins) holds the standard lists and the letterhead (address, phone, license #).
- **Activity and bid item templates:** the **Activities** and **Bid items** tabs in Codebooks hold reusable templates, always priced at today's codebook rates. Build them there, or click **→ Codebook** / **Save to codebook** in an estimate (admins). Add them to an estimate from the **From … codebook** lists.

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
  - Push calculator and takeoff quantities into bid items.
- **AI takeoff — the whole site** — upload the plan set and have the app do the full takeoff for the estimator to review: **dirtwork** (cut/fill, import/export, strip, pads), **underground** (storm, sanitary and water pipe LF by size and material, structures with inverts and depths, fittings, bedding, trench), **erosion control** (silt fence, inlet protection, construction entrance, check dams, matting, seeding), **demo** (pavement, concrete, curb, structures, clearing, utilities), plus paving, curb and concrete. Every quantity links back to where it was found on the sheet.
- Pull contour lines straight out of vector PDFs (label elevations only).
- Save takeoffs to a bid and share them with the team.
- Read Agtek .tn3 / Trimble .ttm surfaces and DWG files.

## Good to know
- **Free plan pausing:** Supabase pauses free projects after about a week with no activity. Normal daily use prevents it. If it pauses, click **Restore** in the dashboard. The Pro plan ($25/mo) never pauses and adds daily backups.
- **Public repository is fine:** nothing secret is in these files. GitHub Pages on a private repository needs a paid GitHub plan.
- **Re-running `schema.sql`:** safe to do. It keeps your data and refreshes the security rules.


## Estimators: see every bid, ask to work on one

Needs `supabase/update-24-estimator-view-requests.sql`.

- Estimators now see every bid by default, read-only, and work only on the ones they're assigned to. The dashboard and pipeline have an **Assigned to me / All projects** switch.
- Opening a bid they're not on shows **Request to work on it**. The bid's lead estimator and whoever manages all bids (admins by default) see the request on the dashboard and inside the bid; the lead approving needs `supabase/update-31-lead-approves-requests.sql`. **Approve** adds the estimator as a supporting estimator; **Deny** closes it.
- On Team → a person's access, **Which bids** has three levels: Assigned only, See all / work on assigned, All bids. Set someone to Assigned only to keep the old behavior.

## Change orders

Needs `supabase/update-25-change-orders.sql`. Open a job → **Change orders** tab. Anyone who can edit jobs (PMs and admins by default) writes them.

- **Pricing lines:** labor, equipment, material, subcontract, trucking or other, each with quantity and unit cost. People with codebook access can pick an item to fill in its unit and price. **From a contract item** adds work at the job's bid unit price, which is not marked up again. Use a negative quantity for a credit.
- **Markup:** separate percentages for your own work and for subs, plus bond/insurance. They carry over to the next change order on the job.
- **Status:** Draft → Sent → Approved or Rejected, with dates and who approved. **Approved** adds a change-order line to the job's budget and schedule of values (so it bills on pay apps) and locks the change order.
- **Days:** working days added to the contract time.
- **Print / PDF:** a change order request with pricing (every line or totals by type), the contract summary (original, previously approved, this one, revised) and signature lines.
- The top of the tab shows the original contract, approved, sent and draft amounts, and the revised contract.

## Creating and managing logins from the app

Needs `supabase/update-26-accounts.sql`, and "Allow new users to sign up" left ON in Supabase (Authentication → Sign In / Providers). Turning "Confirm email" OFF there avoids Supabase's limit on confirmation emails; the app confirms new logins itself either way.

- **Add a person:** Team → People & access → **+ Add a person**. Enter name, email, role and title; the app makes a temporary password and shows it once with a Copy button. You stay signed in.
- **Manage a login:** open a person (**Edit access…**) and use the Login box: email a password reset link, set a temporary password, deactivate or reactivate, or delete the account.
- **First sign-in:** after an admin creates a login or sets a temporary password, the person must choose their own password the next time they sign in, before they can open anything. Needs `supabase/update-27-first-login-password.sql`.
- **Deactivate** blocks sign-in and removes access right away but keeps the account. Reactivating brings the login back with no role; pick one and save.
- **Delete** removes the login for good. Their bids, notes and history stay.
- You can't deactivate or delete your own account, and only the developer can change the developer account.
- No secret key is stored in the app. Each action runs a database function that checks the signed-in person is an admin.

## Client bid tracker

Needs `supabase/update-28-client-tracker.sql`.

- **What the client gets:** one private link per GC / client. It opens without a login and shows every project that client has sent you, each with a five-step tracker (Received → Estimating → Final review → Proposal sent → Decision), the bid due date, when to expect the proposal, which addenda you've acknowledged, and the lead estimator's name, phone and email. The page refreshes itself every minute.
- **What it never shows:** prices, margins, other GCs on the same job, notes, quotes or files. A bid comes off the page as soon as it is Awarded, Not Awarded or No Bid.
- **Stages come from the bid's pipeline stage:** Project Created = Received; RFQ Sent, Takeoff, Quotes Received and Estimating = Estimating; Proposal Review = Final review; Submitted (or that GC's proposal marked Sent) = Proposal sent, Awarded / Not Awarded = Decision. On Hold and No Bid show as such. Decided and archived bids never show.
- **Proposal expected by:** a new date on the bid, next to the bid due date. Blank means the due date.
- **Search and filters:** the client can search by project name or location, filter by stage, and sort by due date, name, stage or newest.
- **Sending it:** when you save a new bid that has a GC on it, the app opens the tracker window with the link and a ready-to-edit email. **Copy link**, **Copy email** or **Open in my email**, then send it yourself. The same window is on every bid (the "Client tracker" line at the top) and on the client's page under Contacts.
- **One link per client:** the link keeps working for future projects, so each client only needs it once. An admin can **Replace this link**, which turns the old one off.


## Pipeline stages

Needs `supabase/update-29-pipeline-stages.sql`. Run it first, then upload the new `app.js` right away.

The pipeline follows the order the work happens:

1. **Project Created** – the invitation is in.
2. **RFQ Sent** – quote requests are out to vendors and subs.
3. **Takeoff** – quantities are being taken off.
4. **Quotes Received** – vendor and sub quotes are back.
5. **Estimating** – building and pricing the estimate.
6. **Proposal Review** – the estimate is being checked and the proposal written.
7. **Submitted** – the proposal has gone to the GC.

Then **Awarded**, **Not Awarded** or **No Bid**; **On Hold** at any point.

- **Moving a bid:** click a stage on the bar at the top of the bid, or use the Bid status dropdown.
- **Moves by itself (forward only):** adding a quote request → RFQ Sent; starting a scope → Takeoff; every scope signed off and every quote answered → Quotes Received (or straight to Estimating when the bid has no quote requests); proposal marked sent → Submitted. Estimating and Proposal Review are set by hand.
- **Old bids:** Not Started became Project Created, and Takeoff Complete became Estimating. Importing a spreadsheet still accepts the old names.


## GC follow-up after the proposal goes out

Needs `supabase/update-30-follow-ups.sql`.

- **Reminders:** once a bid is Submitted, the app counts the days since the proposal went out. The dashboard shows one block with how many bids need a follow-up, for the bid's estimators and for everyone who manages all bids. Click it for the full list, with search, Due / Coming up / All, and sorting. **Pause** stops reminders for a bid, and **Pause those N** clears out everything that went out more than a month ago in one go.
- **Per-bid plan:** in the follow-up window, set the days between follow-ups and how many to send for that bid. Blank uses the company default (7 days, 3 follow-ups), which an admin can change from the same window. **Remind me in a week** pushes one reminder back; **Pause follow-ups** turns them off for that bid.
- **Email drafts:** pick the GC and the kind (follow-up 1, 2, 3, a request for a Teams/Zoom review, or a meeting confirmation). Edit it, then **Copy email** or **Open in my email** and send it yourself. Click **I sent it** to log it and start the clock for the next one.
- **Meeting:** enter the date, time and Teams/Zoom link. Reminders hold until the meeting. Afterwards the app asks what you learned: where you stand, who else is bidding, the expected decision date and a new win probability. That is written to the follow-up log, and the next reminder waits for the decision date.
- **Stops by itself:** when the bid is Awarded, Not Awarded, No Bid or On Hold, or all its follow-ups are sent.
- Open it from the dashboard list or the **GC follow-up** line at the top of a submitted bid. The client's tracker page is not affected by follow-ups.

- **Supporting estimators:** on a bid's Estimating team, the **+ Add** list has **Entire team**, which adds every other active estimator at once, and **Remove all** clears them. Changing the lead takes that person out of the supporting list.


## Turning tabs off

Team → Access chart → **Tabs in use** (admins). Untick a tab to hide it for everyone, admins included: Dashboard, Pipeline, Estimates (with codebooks and bid settings), Jobs, Accounting, Contacts, Calculators, Break room or Help. Buttons and links that lead to a hidden tab disappear too, and the hidden games stop opening when Break room is off. Nothing is deleted; tick the tab again and everything is back. Team always stays on.

This hides the tab in the app. It does not change who is allowed to read the data, so use a person's access settings (Team → People & access) when something must be kept from someone.
