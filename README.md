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
supabase/update-35-presence.sql            optional: "last seen" in the who's-online list (who's on right now works without it)
supabase/update-36-planner.sql             one-time update for the Planner (my tasks, team board, calendar)
supabase/update-37-vendor-rankings.sql    one-time update for vendor rankings, price lists and vendor update links
supabase/update-38-vendor-cleanup.sql     small follow-up: lets Reset clear a vendor's price history
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

## Planner (everyone)

Needs `supabase/update-36-planner.sql`.

**My tasks** is your own to-do list. Type a task in the box and press Enter. Words in it fill in the details:
- **today**, **tomorrow**, **fri**, **next week** or **10/20** set the due date, and **3pm** sets a time.
- **!** marks it high priority and **!!** urgent.
- **#team** shares it with the team, and **@eddie** assigns it to Eddie.

As you type, the line under the box shows what it understood. **Steps:** after you add a task, the cursor drops into its **First step** box, so you can type the steps to get it done, pressing Enter after each one. A blank Enter goes back to adding tasks. Steps understand the same shortcuts, so "Takeoff in AGTEK wed" gets a date and "Send RFQs @eddie" gets a person. The task shows **2/4 steps** with a progress bar; click that (or **+ steps** on any task) to open the steps. You can check them off, reorder them with ↑ ↓, or remove them. When the last step is checked, the task offers **Mark the task done**. Steps with a date show on the Calendar, and team board cards show the progress and the next steps. Tasks are grouped Overdue, Today, Tomorrow, This week, Later and No date. Click the circle to check one off. Click a task to open it, where you can add notes, a checklist, a bid or job, a list name (Bids, Admin…), a person it's assigned to, or a repeat (every day, weekday, week or month). When you check off a repeating task, the next one is made for you. The small month on the side marks days with something due; click a day to open it in the Calendar. **Planner (n)** in the top bar counts your tasks that are due today or overdue.

**Share with the team** (the 👥 button on a task's row, or the switch in the task) puts it on the **Team board** and the team calendar. Until then, only you and the person it's assigned to can see it. The board has To do, Doing and Done columns: drag a card to move it, and click a person to see just their work, with how many are open and late. Anyone can move a shared task along, but only the person who made it can take it off the board, and only they (or an admin) can delete it.

**Calendar** shows your tasks, team tasks and bid dates (bid due, site walk, RFIs) by month; each can be switched on or off. Click a day to see everything on it and add a task for that day. Drag a task to another day to move it.

## Archiving old or filler bids (admins)

**Pipeline → 🗄 Archive…** archives many bids at once. You can choose:
- everything in the pipeline,
- bids added on certain days, which is how to pick out an Excel import (the day with the most bids is ticked for you),
- bids due before a date, with or without the ones that have no due date,
- or every decided bid (awarded, not awarded, no bid).

The window lists what will go before you confirm. Archived bids keep their estimates, quotes, files and log. They leave the pipeline, the dashboards, win rates, estimator stats and the Estimates list (choose **Archived bids** there to see them), and they're under **🗄 Archived** in the Pipeline. There, each archiving run is listed with its own **Restore** button, so a whole batch comes back in one click; single bids restore from **Select**. To count archived bids in the numbers again, tick **Include archived** on the Board dashboard.

## Trades & scopes (Contacts tab)

**Contacts → Trades & scopes** has both lists in one place, and it works with the Estimates tab turned off.
- **Trades** are the categories for vendors and subs. Admins click **Edit trades** to rename, reorder, add or remove them. Renaming a trade updates every vendor tagged with it. Removing one asks which trade its vendors move to. "Other" is always kept.
- **Scopes** are the list your team picks from on bids and ticks on each vendor. Click **✎ Edit scopes** to rename a scope, move it to another group, set who usually performs it, remove it, or type a new one in the "+ Add a scope" box under any group, then **Save scope list**.
- **Groups** are edited in the same place. Type over a group's name to rename it, use ↑ to move it up, and click **Remove group** to delete it (you choose which group its scopes move to). Type a name in the **New group** box and press Enter to create one, then add scopes to it or move existing scopes over with their group dropdown. "Other" is always kept. Renamed groups still feed the same scope columns on the dashboard.
- Renaming a scope updates the vendors who quote it and your templates. Bids already using the old name keep it.
- In a vendor's window, under **Scopes they quote**, type a scope that isn't listed and press Enter. It's added to the company list and ticked for that vendor. **✎ Edit scope list** there opens the full list and returns you to the vendor afterwards.
- **Scope templates** apply a set of scopes to a bid in one click. Use **+ New template** to add one.

## Vendor rankings and price lists

Needs `supabase/update-37-vendor-rankings.sql`.

**Score.** Every vendor gets a score from 0 to 100 and a grade (A 85+, B 70+, C 55+, D) made of four parts:
- **Team ratings (40%):** anyone rates a vendor 1–5 stars on price, quality, communication and schedule, plus "would use again". Each person's latest rating counts.
- **Response rate (25%):** RFQs answered out of RFQs sent. A request still within its due date doesn't count against them.
- **Speed (10%):** their typical number of days from request to quote.
- **Price (25%):** how often they're the low number when two or more vendors quote the same scope on one bid, and how far above low they usually are.

Parts with no data are left out and the rest count for more. A vendor with very little history is marked "early days".

**The vendor page.** Click a vendor under **Contacts → Vendors & subs**. It has four tabs:
- **Overview:** how the score adds up.
- **Price list:** spreadsheet-style. Suppliers have materials (item, size/spec, unit, price, lead time); subs have services (service, description, unit, rate, minimum/mobilization); a vendor that's both gets both. Click a cell and type, and changes save as you go. Enter moves down and Tab moves across. Paste rows copied from Excel into the empty Item cell. **Prices confirmed today** marks every price as checked, and **Price history** shows every change with the percent up or down.
- **Team ratings.**
- **Quotes.**

**Service regions and home base** go in the vendor's details, and vendors can be filtered by region.

**Import a price list.** On a vendor's **Price list** tab, **⬆ Import file** reads an Excel (.xlsx, .xls), CSV or PDF price list or quote sheet. It finds the columns by their headings (Item, Description, Size, U/M, Unit price…). With no headings, it goes by what's in them: dollar amounts are the price, TON/CY/LF/EA are the unit, and words are the item. Units are tidied to TON, CY, LF and so on. Before anything is added you see:
- which column it took for what, each one changeable,
- every row it found, each with a tick box,
- whether to add new items and update prices of matching ones, or replace the whole list.

Rows with no price (headings, notes, "delivery included…") are left out unless you ask for them. Scanned-picture PDFs can't be read; use the Excel version or a PDF you can select text in. Vendors get the same **Import from Excel or PDF** button on their own update page, and still check and save.

**Using vendor prices in an estimate.** In an activity's costs, **🏷️ Vendor prices** searches every vendor's price list ("57 stone", "15 RCP", "paving"). Matching items are grouped, the lowest price comes first with how much higher the others are, and each vendor's score and the age of the price are shown. You can narrow it to materials or services, one vendor, or a region. **Add** puts the price on the activity: materials come in as material lines (with sales tax) and services as subcontract lines. The line is tagged "Price list · vendor", with "· 50d old" when that price is out of date. Typing a different price replaces it, the same as a quote.

**Vendor update link.** **✉ Send price link** makes a private page with only that vendor's price list, and **Email it** opens an email to them with the link. They open it without logging in, change prices, add or remove items, and click **Save prices**. Their changes are marked "vendor" with their name. Links last 60 days, and **New link** or **Turn it off** stops the old one working. You can always edit the list yourself.

**Vendor rankings** (Contacts tab) is a dashboard built from cards you choose:
- top or lowest ranked (3, 5, 10…; subs, suppliers or all),
- lowest or highest price for an item across vendors,
- fastest to quote,
- needs attention.

Each card can be narrowed by trade, scope and region. **+ Add a card** adds one, and ⚙ on a card changes it. Your layout is kept on your computer. Below the cards is every vendor ranked, with each part of the score.

**Reset or delete vendors.** **🧹 Reset or delete…** on Vendors & subs (or 🧹 on a vendor's page) works on one vendor or many; search, tick them, or **Pick all**:
- **Reset** keeps the vendors and their contact details, and clears their ratings, price lists, price history and update links, so their ranking starts fresh.
- **Delete** removes the vendors completely. You type DELETE to confirm, and it can't be undone.

Either way you can also delete their quotes on bids. Otherwise those quotes stay on the bids: after a reset they still count toward the vendor's response rate, and after a delete they're left with no vendor.

**Reminders.** A vendor's ranking is flagged when nobody has rated them in 30 days; only vendors you've used lately or marked preferred are flagged. Pricing is flagged once any of its prices are over 30 days old. Admins can change both numbers under **⚙ Reminders**. The precon dashboard shows a "Vendor upkeep" line when anything is due.

## Who's online (everyone)

The top bar shows who else has the app open, with a green dot for active and amber for away (tab hidden, or no mouse or keys for 5 minutes). If someone has the same page open as you, the bar says so ("👀 Pat is here too"); it's worth a word before you both edit one estimate or takeoff. Click it to see each person's page and bid, for example "Takeoff · High Falls 16". This uses Supabase Realtime and needs no setup. Run `supabase/update-35-presence.sql` once and the list also shows **Recently**: who was on earlier and when.

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


**Build It Up** (Games) is a merge-three puzzle on a 6×6 lot. Three or more matching pieces side by side merge into the next one up, in the spot where you placed the last one: survey stake → cone → barricade → tool shed → job trailer → house → office → tower. Four or more score double, and hovering a spot outlines what it would merge.

- **Gophers** move each turn. A gopher boxed in with nowhere to go digs in and leaves a dirt mound; three mounds make a stockpile, and three stockpiles make a quarry.
- **Rocks** merge into boulders, and three boulders make gold, which you click to cash in.
- **The excavator** becomes whatever makes the biggest merge, and **dynamite** clears a spot.
- **The laydown yard** holds one piece for later.

A game in progress is saved on that computer. High scores go on the office board, and there's a trophy for 20,000, 100,000 and 400,000 points.

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
- **The bid page.** Opening a bid fills the screen with a tab for each step: Project, Scopes & RFQs, Takeoff, Quotes, Estimate, Proposal, Follow-up & outcome. A bid opens on its current step (a new bid on Project), and each tab shows how far along it is (e.g. 3/5 requested). Any tab can be opened at any time; looking at a tab never moves the bid. Notes and project files stay on the right on every tab. Changes save on their own a second after you stop typing ("Saved" shows at the top). A new bid is created with **Create bid**, then saves as you go. The Project tab's Key dates include **Plan date**, the date on the plan set you're bidding from; the RFQ email uses it in the project table and in the default plans link text. Each bid has its own link (the address ends in `#bid=…`), so you can send someone straight to it.
- **Dogwood-branded GC tracker and vendor price-list pages.** Both pages open with a Dogwood green banner and logo, "Bids prepared for [GC]", the browser tab reads "Dogwood Site Contractors · Bid tracker", and a footer carries the logo mark, office address, phone, website and estimating@ email (links work on phones). Light and dark versions and phone layouts. Company details come from `COMPANY` in app.js and can be overridden with a `company` block in config.js.
- **Money formatting.** Dollar boxes across the app (bid numbers, GC numbers, quote amounts, vendor prices, quote lines, job and accounting amounts, pipeline value filters, and any box with a $ placeholder) show commas as you type (1250000 → 1,250,000) with the cursor kept in place. "1.25M" and "250k" expand when you leave the box, and pasted "$1,250,000.00" reads correctly. Quantities on quotes and job logs get commas too. Takeoff, elevation and percent boxes are left alone.
- **Phone and email cleanup.** Phone boxes format themselves when you leave them: "7706277776", "770.627.7776" and "+1 770 627 7776" all become (770) 627-7776; extensions are kept ("x204"); numbers that aren't 10-digit US numbers are left as typed. Email boxes catch typos (".con", "gmial", "@@", missing @) and show "Did you mean …? Use it". Saves and Excel imports get the same cleanup. Admins: **Contacts → Clients & GCs → Tidy phones & emails** lists every change across clients, contacts, vendors and people before applying it.
- **Estimate & proposal.** The estimate and the proposal are one step: on the pipeline (7 steps instead of 8) and as one tab on the bid page. The tab has one status: **Not started → In progress → Ready for review → Sent**, plus the estimate, base numbers, each GC's number and the revision log. **Ready for review** puts the bid on a "ready for review" list on managers' dashboards (and on the lead's own dashboard). **Sent** asks which GCs it went to and the date, marks them sent, moves the bid to Proposal sent and starts the GC follow-up clock. Moving a sent bid back asks first and clears the sent marks. Stored statuses are unchanged (Estimating = In progress, Proposal Review = Ready for review), so older bids and the client tracker read the same.
- **Team: positions and access.** Team has three tabs: **People & access**, **Positions** and **Access chart**. *Positions* are the jobs at the company (starter list: Precon Manager, Senior Estimator, Estimator, Project Manager, Accounting, Executive); admins rename, add or remove them with **✎ Edit positions**. Each position says what it does (**Works bids**, **Runs jobs**, **Office**) and its **default access**. On People & access every account has a **Position** and an **Access** level. Picking a position sets the access it usually gets (you can still change it) and, if it works bids, sets the person up for bids automatically, so there's no estimator record to link by hand. Filters: everyone, works bids, runs jobs, office, no position, no login. **+ Add a person** creates the login, sets the position and access, and sets them up for bids if their position works bids. Existing accounts keep their access and custom settings; nothing changes for a person until you give them a position.
- **Budget pricing, no RFQs.** For preliminary numbers where you know who you're using but aren't asking for quotes yet. A vendor's status can be **Budget, no RFQ**: the amount is your own rough number (marked "Budget"), it's left out of the RFQ email, Mark all requested and the "not requested" warnings, it counts as covering the scope, and vendor rankings ignore it. **Request a quote now** on that vendor flips it to Not requested. The **Budget pricing, no RFQs** switch at the top of Scopes & RFQs makes every vendor you add a budget line and hides the RFQ email; it turns on by itself when the Bid type is Budget / pricing, and you can flip it either way. Turning it off sets the budget lines to Not requested, ready for the RFQ email.
- **Up for grabs** (Pipeline → Up for grabs). A manager posts a bid with no lead: on the bid's Project tab, under Estimating team, click **📣 Post to Up for grabs** and add a note and a "needs an owner by" date. It shows on the Up for grabs board, and the Pipeline tab shows a count. Each card has the project, GC, bid due date, type, size, site walk, scopes and the note, and the top of the board shows how many bids you already have. **✋ I'll take it** makes you lead right away and adds a task to your planner; **I can help** adds you as a supporting estimator. Managers can **Take down** a post, pick a lead themselves (which takes it down), or **Put back up for grabs** to clear the lead and repost. Cards turn orange when the bid is due within a week and red when the owner-by date is a day away. Needs `supabase/update-41-up-for-grabs.sql`.
- **Tracker link status.** The top of every bid shows each GC on it: "Tracker link not sent yet", "sent Oct 2 by Bryson · no need to resend until Nov 1", or "time to send it again" after 30 days. One tracker link covers all of a client's bids, so a send from any bid or from Clients & GCs counts for all of them. **Send tracker link** opens the link and email inside the bid page; after you copy or open the email, **Mark as sent today** records it. Needs `supabase/update-40-track-sends.sql`.
- **Quotes due.** The Scopes & RFQs tab has one **Quotes due** date for the whole RFQ, since every vendor gets the same email. Every open quote takes that date, and vendors added later pick it up. Each vendor's row has a **Received** date instead; entering it marks the quote Received.
- **RFQ email** (✉ RFQ email… on the Scopes & RFQs tab) writes the request in Dogwood's format: project and location, the quotes-due line, an optional note (e.g. Phase 1 & 2 only, also added to the subject), where to send RFIs and bids, anticipated start, the plans link, and the Project Address / Description / Engineer table. The description lists the scopes on the request, and scopes you self perform are marked "(material)". Pick which vendors it goes to. Three ways to send, all with Cc estimating@dogwoodsite.com, every vendor in Bcc and the subject filled in: **Open in Outlook (web)** opens a new Outlook on the web email and copies the formatted message (click in the body, Ctrl+V, send); **Outlook draft file** downloads a draft that opens in Outlook with the formatted message already in it; **Open in mail app** uses your computer's default mail app (paste the message the same way). The one you used last is the default next time. Outlook adds your signature. The vendors it went to are marked Requested. Vendors with no email on file are listed and left off. Admins can change the template (✎ Edit template): **bold**, __underline__ and {fields}. The RFQ details (plans link, engineer, start, note) are saved with the bid; this needs `supabase/update-39-rfq.sql`, and until that's run they're kept in your browser.
- **Takeoff groups.** On the Takeoff tab, **▦ Group scopes…** lets you pick scopes that go together (e.g. Storm, Sewer, Water → "Utilities") and name the group. A group has one person, one status and one **Sign off group**, which signs off every scope in it with your initials. Click the group name to rename it, × to take a scope out, + scope to add one, **Ungroup** to put them back on their own rows (they keep their status). Scopes not in a group keep their own row as before, and you can mix both on one bid.
- **Vendor & sub quotes are laid out by scope.** Each scope on the bid gets a row with its vendors under it and its own **+ Add vendor or sub…** picker (vendors who quote that scope are listed first).
- **One quote per vendor.** Pick the same vendor for another scope and that scope is added to their open quote, so they send one price for all of it. Chips on the quote show what it covers: × takes a scope off, **+ scope** adds one. The quote is edited under its first scope and listed by name under the others. If a vendor already has separate open requests on a bid, **Combine into one quote** merges them.
- **Moving the stage:** the stage doesn't move by itself anymore (except that marking the proposal sent moves it to Submitted). On the bid page, **Advance** moves it to the next step. Advance lights up when the step is done; if something is still open it says what, and a second click advances anyway. You can also set any stage from the status menu at the top of the bid.
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

## Guide mode and Feedback mode

Two helpers each person switches on or off for themselves, at the top of the **Help** tab. The first time someone signs in on a browser, the app asks whether they'd like the guide (and, optionally, feedback mode).

- **Guide mode:** Rivet, a small construction bot, walks to things on the page and explains them: a tour for every tab, sub-tab and pop-up window (each estimate tab, each codebook, each calculator, each accounting tab, the bid window section by section), with Next / Back / Got it. He only talks about things that person can actually see. After a tour he rests in the corner; click him to hear it again, or **Replay every tour** under Help. Needs nothing in the database.
- **Feedback mode:** a card in the corner asks "How is *this feature* working for you?" for whatever page, estimate tab or window is open. Pick one of five faces (Broken, Clunky, OK, Good, Love it), add a note if you like, and Send. One rating per person per feature; sending again updates it. **List** shows the checklist of everything there is to review and what's been done. Needs `supabase/update-32-guide-feedback-modes.sql`.
- **Developer → User reports:** every rating, worst-rated features first, with the spread of scores, the comments, coverage by person and the latest activity. It refreshes itself every 15 seconds while open. People see only their own ratings; the developer sees all of them.


## Import takeoff: quantities in, estimate out

Needs `supabase/update-33-takeoff-import.sql` to remember matches (importing works without it).

In an estimate, **Build → ⬇ Import takeoff**.

### AGTEK reports

The checklist is the five AGTEK reports: **Earthwork, Structure measures, Materials, Trench volume, Depth brackets**. Click **Choose files** and pick all of them at once. Each file is recognised by its column headings and goes to the right slot with no column picking.

- **Summary or detail both work.** A detail report has one row per drawn object; the app adds the rows up, which gives the same lines as the summary. The one exception is Trench Volume: its detail report has no excavation column, so use the summary.
- **Material report or Structure report:** they hold the same numbers sorted two ways, so either one fills the Materials slot.
- **Earthwork** gives Cut, Fill, Fill with compaction, Export or Import, Site area, then an area and a volume for every named area (Stripping, House Pad, Sidewalk, Respread…), with repeated names added together.
- **Structure measures** gives one line per structure: pipe in LF, structures in EA, areas in SF.
- **Materials** gives one line per material per class (Bedding for Storm and Bedding for Sewer are separate lines). A material that is only the structure counting itself (Catch Basin under Catch Basin) is marked *In Structure measures* and counted once, there.
- **Trench volume** gives trench excavation in CY per pipe.
- **Depth brackets** gives pipe length per depth bracket for each class (see depth premium below).
- **Skip the unmatched shown** leaves lines out of this estimate only. Nothing is remembered, so they come up again on the next job.
- Phases in a file are added together. Strata rows in the Trench Volume and Depth Bracket reports become their own lines, named with the stratum.

### Import from ProEstimate

**Codebook → Import from ProEstimate.** Choose every export at once. Each file is recognised by its column headings, and the screen shows which ProEstimate export it is, where it goes and what will happen before anything is saved.

| ProEstimate export | Goes to |
|---|---|
| Labor rates | Codebook › Labor (craft and base wage) |
| Equipment rates | Codebook › Equipment (ProEstimate's Total per hour, no operator; the rate build-up is switched off so the rate stays) |
| Material list | Codebook › Materials (ID, description, category, unit, price) |
| Crew list | Codebook › Crews (name, category, production in the notes; members are not in the export) |
| Crew detail report (Crew Database Detail Report, one file per crew) | Codebook › Crews: the people and machines on the crew, linked to the Labor and Equipment lines by ID and name. A labor or equipment line that is not in the codebook is added. Crew cost is worked out from codebook rates; ProEstimate's own hourly figure is kept in the notes |
| Master project (pay items with activities) | Codebook › Bid items, one per pay item with the same number, holding its activities. Activities under a differently named pay item also go to Activities |
| Pay item list (DOT) | Off unless ticked: it has no costs or activities |

- Bid items come in at ProEstimate's unit cost, split into labor, equipment, material, subcontract and other per unit. The export has no crews or production under the activities, so man-hours and durations are empty until crews are attached.
- Categories follow the pay item number: 100 General Conditions, 200 Erosion Control, 300 Clearing, 350 Demolition, 400 Earthwork, 500/501 Storm, 600 Sewer, 650 Force Main, 700/701 Water, 800 Curb & Concrete, 900 Paving, 1000 Walls, 1100 Rock & Unsuitable.
- Running it again leaves what is already in the codebook alone.

### Codebook pack

`dogwood-codebook-pack.json` is a ready-made set of bid items, activities and takeoff matches. Load it in **Codebook → Import from ProEstimate → Choose files**, in place of the master project export.

- Every pay item in the master keeps its number, name, unit and unit cost. Each activity has a production (the master's quantity is one 10-hour crew day), a crew labor cost per hour and a crew equipment cost per hour, so durations and the schedule fill in.
- Bid items numbered `.N01`, `.N02`… are AGTEK structures with no pay item. They have no price yet.
- Takeoff matches for the AGTEK structure and material lists are loaded as remembered matches.
- Loading the pack replaces a bid item or activity of the same number and name with the pack's version. Do not load it over items the team has already edited unless you mean to reset them.

### Takeoff to ProEstimate bid items

- A takeoff line is suggested for a bid item with the same words in any order (AGTEK `8" PVC - SDR26` and pay item `8" SDR26 PVC`), preferring the same class (Storm, Sewer, Water).
- **Depth premium:** the Depth Bracket report gives pipe length per bracket for each class. The whole length still goes on the pipe's own line from Structure measures; the length in the 10-12 bracket goes to that class's *Depth Premium 10'-12'* item, and so on. Brackets with no premium item are greyed as *No premium at this depth*. Set AGTEK's brackets to match the premium items (10-12, 12-14, 14-16, 16-18, 18-20, 20+).
- Items built from the takeoff keep the ProEstimate pay item number.

1. **Reports checklist.** The left side lists the reports you import for every job (the five AGTEK reports to start; an admin can change the list). A tick shows which ones are in for this job, with the file name, line count, date and who did it.
2. **Add a report.** Pick the report, then choose its file (Excel, CSV or text) or paste the rows. The app finds the name, quantity, unit and code columns, shows a preview, and lets you correct them. It skips headings and total rows. Importing a report again replaces that report's lines.
3. **Match.** Every takeoff line gets a codebook **bid item**. The app suggests one when the line's code matches a bid item's code or its name matches the bid item's name. Otherwise pick one from the list.
   - **Factor** multiplies the takeoff quantity (SF to SY is 0.1111). The box turns amber when the units differ and the factor is still 1.
   - **Also fill another bid item** lets one takeoff number drive several items, each with its own factor.
   - Several lines can go to the same bid item; they add up.
   - **Skip** leaves a line out.
4. **Build the estimate.** Every matched bid item is added with its quantity, activities, crews and current codebook prices, into a section named after the bid item's codebook category, in cost-code order.

- **Remembered:** matches, factors and skips are saved for the whole company, so on the next job the same takeoff names match by themselves.
- **Re-import:** when the takeoff changes, import the report again and click **Update the estimate**. Quantities change on the items already there, nothing is duplicated, and a note lists what moved and anything no longer in the takeoff (left in place for you to check).
- **Setting up the codebook:** each bid item needs its activities saved with it (Estimates → Codebooks → Bid items) and a category. Giving bid items the same codes you use in the takeoff makes matching automatic from day one.

## Estimate: Project info

The first tab of an estimate. **General** holds location, project numbers, project type, plan revision date, estimated start and completion, and notes; bid date, estimator and status are shown from the bid. **Owner, Engineer and Designer** each take a name, address, contact, phone, mobile and email: start typing a company from Contacts and its details fill in, or type a new one, which is kept on this estimate only. **Project address** sits below. Everything saves with the estimate; no SQL needed.

## Takeoff workspace

Needs `supabase/update-34-takeoffs.sql` to save (you can work without it, but nothing is kept).

**Estimates → Takeoff**, or **⛰ Takeoff** in a bid's Estimate section. One takeoff per bid, saved with the bid.

**Without a bid:** Calculators → **Takeoff workspace** → **+ New takeoff**. It works the same, is saved to your account (only you, and admins, can see it) and opens on any computer. Name it at the top. **Move to a bid…** makes it that bid's takeoff, if the bid doesn't have one yet; it then follows the bid's rules like any other.

**Take off: pick what you're measuring.** The top of the left panel lists items by kind:
- **Grading:** contours and spots, existing or proposed.
- **Paving & pads, Concrete, Erosion control, Site, Demolition:** curb & gutter, sidewalk, silt fence, inlet protection, signs and the like.
- **Pipe:** storm, sanitary and water.

Click one and trace it on the plan, or switch to **Pick from plan** and click its lines or symbols. Each symbol you click is counted, and each outline becomes an area. You don't make surfaces or types first: the first time you use an item, it makes the surface it belongs on (Concrete, Paving, Erosion control…) and the item type, with typical widths and concrete per foot. You can change those in the item types under the surface. Totals show next to each item as you go. **Done** or Esc puts the item down.
- Type in the search box to find an item. If it isn't listed, add it as a Line, Area or Count; it's kept under **My items** for that takeoff.
- **Own surfaces / All on …** at the top decides where new lines, areas and counts go: each kind on its own surface, or everything on one surface. Grading and pipes always keep their own.
- A selected line, area or count has an **Item** list on its card to change what it is, for example 24″ curb & gutter to header curb, or to move it to another surface.
- Area items carry **Conc** and **Base** thickness for concrete and stone CY, plus a **Section** depth. With a Section depth, cut / fill runs to subgrade inside those areas. Paving items also report SY.
- The tools never dead-end. If the active surface can't hold what you're drawing (an area on Existing, say), it goes on a surface that can, and the app says where.

**Toolbar.** Move and Select; **Measure** (Line, Area, Count, Pipe, plus Sweep on an elevation surface); **Fix** (Pick from plan, Edit); **Sheets** (Scale, Point, Align). Contour interval and Check appear when an elevation surface is active. Keys: V move, S select, D line, A area, C count, U pipe, P pick, E edit, W sweep, and F5–F9 for line editing.

**Layout.** Surfaces, alignment points and sheet thumbnails on the left; the model in the middle; the plan on the right. Drag the divider between them. **⧉ Plans in new window** moves the plan to its own window for a second monitor; both stay live, and closing that window brings the plan back. **Plan under model** shows the current sheet faintly under the model.

**The plan file** stays on each computer (a 60+ MB PDF is too big to keep in the database). It's remembered in the browser, so it reopens by itself on the same computer. On another computer the takeoff asks for the file; everything done so far is already there.

**Placing sheets.**
1. **Scale** each sheet: pick its scale from the list (1" = 10' to 200', for full-size sheets) or click both ends of its bar scale and type the distance. Every sheet keeps its own scale, shown under its thumbnail. The first sheet you scale sets the job's coordinates (the reference sheet).
2. **Alignment points (◎):** click two or three spots that appear on every sheet (property corners, a benchmark, a building corner) and name them.
   - **New plan set, or deleted the points?** Scaling a sheet while there are fewer than two alignment points makes it the new reference. On a sheet that already has a scale, **Make this the reference sheet** (in the Align card) does the same. Then add points on it and line the others up again.
3. **Align sheet** on every other sheet: click each named point where it sits. Lining up moves and turns the sheet but keeps its own scale. One point is enough to place a scaled sheet (no turn); two set its angle; more check the fit, and the app reports how far off they are and flags a sheet whose points suggest a different scale. A sheet with no scale of its own takes its scale from two or more points. Changing a lined-up sheet's scale re-fits it at the new scale. Markers can be hidden.

**Surfaces.** Make as many as you like, with any name and color: **Elevation** (contours and spot elevations), **Takeoff** (lines, areas, counts) or **Utility** (pipe tools come later). Show, hide or lock each one; the active one is where new work goes.

**Tools.**
- **Pick:** reads the sheet's linework with its CAD layers. Click a line to add it, Shift-click or Shift-drag to collect several, or **Add** a whole layer. Dashed contours and contours broken by their labels are joined into whole lines first. Sending a layer to an elevation surface leaves out short symbols. A contour label next to a line is used as its elevation when the PDF kept it as text.
- **Draw** and **Area:** click along a line (Enter, double-click or right-click to finish); snaps to plan linework. Works on the plan or the model.
- **Count / spot:** a count on a takeoff surface, a spot elevation on an elevation surface.
- **Sweep:** set the interval and Rising / Falling, click before the first contour and past the last. Every contour crossed gets an elevation one interval apart, starting from the first one's elevation (asked for if it has none).
- **Next missing** jumps to the next contour without an elevation. **Select** a line to change its elevation, move it to another surface, or delete it. Ctrl+Z / Ctrl+Shift+Z undo and redo.

Keys: V move, S select, P pick, D draw, A area, C count, W sweep, Esc cancel.

**Cut / fill** (toolbar). Pick the two elevation surfaces (From, usually Existing; To, usually Design), and optionally an area on any takeoff surface as the limits. Gives cut, fill, fill with compaction, export or import, area, and deepest cut and fill, with a cut / fill map on the model; hover the model to read both elevations and the cut or fill depth. **Strip “From” by** lowers the From surface (topsoil) and reports the stripping. **Don't bridge gaps over** stops the surface being stretched across open ground between separate areas (default 150 ft). Contours without an elevation are left out and counted. The result is saved with the takeoff.

**Sections (subgrade).** In the Cut / fill card, **Sections** lists every takeoff surface: give a surface a depth in inches (Standard duty paving 8, Building pad 6…) and every area on it becomes a section. To set one area differently, select it and type its own **Section depth**. A picked outline that came in as a line has **Make it an area** on its card. It lowers the surface you choose (normally Design) by that depth inside the area, so cut / fill runs to subgrade; where areas overlap the smallest one wins. Cut / fill shows how many sections it used, and they can be switched off there. The area also reports its section volume.

**Subgrade surface (one surface, every section).** **+ New** surface → kind **Subgrade**. The left panel then lists its **section types**: **+ Section type** for each one (Standard duty paving 12″, Heavy duty paving 16″, Building pad 6″, Sidewalk 4″…), each with a name, depth and color. Click a type to make it the one you're drawing, then use **Area** or **Pick**; every area you add gets that type and is filled with its color. Change a type's depth once and every area of that type follows. To change an area's type, select it and pick another under **Section type** on its card; it can still have its own depth. **Lowers** sets which surface the sections cut into (normally Design). Quantities lists SF and section CY per type.

**Edit lines (F5–F9).** The **✂ Edit lines** tool (or just press the key, on the plan or the model):
- **F5 Break:** click a line where it should break; it becomes two lines (at a point, or anywhere along it). A closed area breaks open into a line that starts and ends there.
- **F6 Add point:** click on a line to add a point there.
- **F7 Move point:** click a point (they show as squares), then click where it goes; it snaps to the plan linework and to other lines' points. Esc cancels.
- **F8 Delete point:** click a point to take it out.
- **F9 Join:** click near the end of one line, then near the end of another; they become one. Contours must have the same elevation (or be 3D lines).
It works on lines, contours (flat, sloped, conformed and 3D), areas and pipe runs. Elevations go with the points: a new point on a 3D line gets the elevation in between, sloped lines stay graded end to end, and joining two 3D lines keeps every elevation. On a pipe run a new point is a bend (change its type in the profile table to make it a structure), and breaking a run makes two runs. Ctrl+Z undoes any edit. F5 no longer reloads the page while the takeoff is open.

**Lines on an elevation surface: flat, sloped, conformed or annotation.** A line's card on an elevation surface (Existing, Design…) has four choices:
- **Flat:** one elevation (a contour).
- **Sloped:** a start and an end elevation; it's graded evenly between them (flowlines, top of curb, ridges, swales). Start is the end you began drawing at.
- **Conform:** takes its elevations from another surface plus an offset (+0.5 for top of curb, −0.67 for subgrade…), a point every few feet so it follows the ground. **All N annotations too** does every annotation line on the surface the same way. A conformed line doesn't follow later changes to that surface: **Conform again**.
- **Annotation:** no elevation. It's shown (dashed) and kept, but not used in the surface and never counted as missing. Give it an elevation any time.
Sloped and conformed lines are 3D breaklines: the surface, cut / fill and the 3D view use their elevation at every point. When you draw a line on an elevation surface, the elevation prompt has an **Annotation** button; **Check contours** has **Make them annotations** for every line still without one; and flat CAD lines sent to an elevation surface come in as annotations.

**3D view.** **🧊 3D** (toolbar) opens the takeoff in 3D. Drag to turn, right-drag or Shift-drag to move, scroll to zoom, Esc to close.
- Each elevation surface can be **Solid** (its real triangles, the same ones cut / fill uses), **Contours**, **Both** or **Hidden**. Existing starts as contours over a solid Design; with lots of contours only every 5th (index) one is drawn.
- **Cut / fill colors** (after a cut / fill run) paint the "To" surface red where it cuts and blue where it fills, darker = deeper, sections included.
- **Linework** lays takeoff, subgrade and utility lines, areas and counts on the ground (curb, silt fence, pad outlines…).
- **Pipes** are drawn at their inverts with their real size, structures from rim to the lowest invert; tick **See-through ground** to see them under the surface.
- **Drape** lays a lined-up plan sheet (one that's been opened on this computer) over the top surface, so you can see the plans on the terrain.
- **Vertical ×** exaggerates the elevations so flat sites still read; it starts at a sensible value for the site.

**Curb, gutter, sidewalk and other item types (takeoff surfaces).** Select a takeoff surface (say "Concrete") and use **+ Add a type…** in the left panel: 24″ / 30″ / 18″ curb & gutter, 6″ header curb, 24″ valley gutter, 4″ / 6″ sidewalk, 8″ heavy duty concrete, or your own line or area item. Click a type to draw it (Draw or Pick for line types, Area or Pick for area types); each item takes the type's color, and curb draws as a band as wide as the curb.
- **Line types** have a width (″) and the concrete in the section (SF per LF); **area types** a thickness (″). Both can have a stone base (″ deep, under the curb's width or the whole area). The built-in sections are typical (24″ C&G ≈ 1.58 SF/LF ≈ 0.059 CY/LF): check them against the job's detail sheet and change them; every item of that type follows.
- **Quantities** per type: LF (or SF), concrete CY and stone base CY. Lines and areas with no type are still totalled for the surface. Change an item's type on its card.

**Check contours.** With an elevation surface active, **✓ Check contours** looks for contours of different elevations that **cross**, and **jumps**: a contour whose neighbor is more than one usual step away (the step is learned from the surface, so it works with every contour or only the index ones). A jump that shows on both sides of one contour names that contour as the one to check, usually a typo (210 for 120). Click an issue to zoom to it; the contour is selected with its elevation ready to fix, and the list updates as you fix them. Contours without an elevation are counted too (Next missing goes to them).

**Import CAD, LandXML or survey points.** **Import** (next to **+ New** under Surfaces) reads a **DXF** (any version, ASCII), a **LandXML** file (Civil 3D, Carlson, Trimble…) or a **point file** (CSV/TXT/PNT, PNEZD and the other usual column orders). DWG can't be read in a browser: in AutoCAD / Civil 3D use Save As → DXF, or export the surfaces to LandXML.
- **Layers:** every CAD layer (or LandXML surface, breakline set, point code, alignment) is listed with what's on it (contours, 3D lines, TIN triangles, points, flat lines) and its elevation range. Pick where each one goes: an existing surface, a new elevation / takeoff / utility surface named after the layer, or Skip. Layers with elevations are sent to Existing or Design by their names (EX-, EG, TOPO → Existing; PROP, FG, GRAD → Design); check them. Find a layer with the search box.
- **What comes in:** contours keep their elevation; 3D lines (breaklines) keep the elevation at every point; 3D faces, polyface meshes and LandXML surfaces come in as a **TIN** that's used as it is for cut / fill and pipe depths (it draws as contours at the takeoff's interval); points with elevations become spot elevations. Lines without elevations can go to a takeoff or utility surface (closed ones become areas). Arcs, circles, bulges and curves are kept as short straight pieces. **Blocks:** a block inserted at an elevation (survey shots, spot blocks) comes in as a point with that elevation; a symbol block (wheel stops, ADA signs, gate valves, silt savers…) comes in as a count, one layer per block name, so it can go straight to a takeoff or utility surface. Text, dimensions, hatches and dynamic/anonymous blocks are left out. **Civil 3D objects** (surfaces, feature lines, pipe networks, alignments) can't travel in a DXF; the import window lists which layers had them and how to get them out (LandXML for surfaces, Export to AutoCAD for feature lines and pipes). Layers named with an X prefix (-XEop, -XSpots) are treated as existing. Units come from the file (DXF $INSUNITS, LandXML units) and can be changed; feet and US survey feet are treated alike.
- **Where it goes:** *the drawing's own coordinates* (best for the first file: the plan sheets then line up to it), *the same place as the last import* (other files from the same project), or *line it up with the alignment points*: click a point name, then the same spot on the drawing (it snaps to the nearest corner). It shows how far off the points are.
- **Plan sheets with a CAD import:** set a sheet's scale, then put alignment points on the **model** (the ◎ tool works there now and snaps to the CAD's corners: property corners, building corners), and click the same points on the sheet with **Align sheet**. Imported linework then shows over every lined-up sheet, a good check that the CAD and the plans agree.
- **Imported files** are listed in the left panel with how many items each brought in; × (twice) takes everything from that file back out.
- Big TINs make the takeoff bigger to save; you'll get a note if it's getting large.

**Civil 3D drawings (DXF).** Civil 3D surfaces, pipe networks, feature lines and labels can't travel in a DXF as objects, but each one carries a copy of how it was drawn, and the import reads those:
- **Surface:** its contours, with elevations (as long as the surface style shows contours).
- **Spot elevation labels:** a spot elevation at the label's point (TC/BC, TW/BW, FFE…).
- **Pipe networks:** pipe runs, ready on a utility surface: structure names and types (J.B., D.I., S.S.M.H., C.O., A.D., G.T.…), rims and inverts from the structure labels, pipe size and material from the pipe labels, runs chained through structures, storm vs sanitary from the layer. Existing ("EX.") pipes come in on their own layer (skipped by default) and existing structures aren't counted as new work. Only inverts written on the structures are used; a pipe missing one says so on its profile.
- **Feature lines, gradings and other drawn objects:** 3D lines.
- **Two grounds in one file:** when layers headed for the same elevation surface don't agree (a 2007 survey TIN and the engineer's existing contours, say), the contours drawn on the plans stay on the surface and the others move to a surface of their own (e.g. "Existing (survey)"), with the difference shown, so cut / fill uses one ground.
On the AC Marriott Alpharetta DXF this gives the finished-grade contours, 224 spot elevations, 39 storm and sewer runs, and cut / fill of 1,441 / 173 CY against the engineer's 1,260 / 143 (our area is ~6% bigger), with no hand work.

**Sheets line themselves up.** With CAD imported, the plan card has **Line it up automatically** (one sheet) and **All sheets**. The scale is read off the sheet: the graphic scale bar first (turned sheets too), then the text (1" = 20', or Civil 3D's 1:20). The sheet's linework is then matched to the CAD, including the index contours of imported surfaces, and turned and shifted until it fits. Sheets in a set sit the same way, so once one is placed the rest are tried at its angle first. A sheet is only placed when the match is clearly good: most of the CAD that falls on the sheet is found, within about a foot and a half. Enlarged sheets showing part of the site count. Detail sheets, and plans that show only what the CAD doesn't (a demolition plan against proposed CAD), are left for alignment points. Without CAD, **Read the scale off the sheet** sets the scale. Each sheet takes about 20 seconds on a large job.

**Sections from surfaces.** When there's a subgrade surface (named Subgrade, SG…) and a finished surface (Design, FG, Proposed…), Cut / fill also measures the depth between them. It lists each section it finds, such as 6″ 1,019,715 SF and 12″ 661,656 SF, and Quantities gets a **Sections (Design − Subgrade)** group with SF and CY for each depth. That's the paving and stone takeoff straight from AGTEK's or the engineer's surfaces.

**Where the existing ground runs short.** If the design reaches a little past the edge of the existing survey (a notch, a void around an old building or pond), Cut / fill carries the existing ground across that patch from the elevations around it, the way AGTEK does, and says how many SF it filled in. **Leave them out** in that line turns it off. Big or long missing areas are never filled. On High Falls 16 this brought the app within 0.1% of AGTEK's own report (Design vs Existing 144,328 / 117,608 CY against AGTEK's 144,446 / 117,668).

**Big surfaces save small.** Imported surfaces are packed and compressed when the takeoff saves (a 60-acre job with three surfaces is about 3 MB). Undo doesn't copy them.

**Units.** A DXF that says inches but has state-plane coordinates (Civil 3D exports often do) is read as feet, and the import window says so.

**Pipe runs (utility surfaces).** Make a surface of kind **Utility** (Storm, Sanitary, Water…), pick the **⦿ Pipe** tool (key U) and click each structure along the run, on the plan or the model; Enter or double-click finishes. Clicking an existing structure connects to it, and a structure with the same name on two runs counts once. A line picked from the plan on a utility surface has **Make it a pipe run** on its card (its ends become structures, the corners bends).
- **The profile panel** opens under the model and plan whenever a run is selected (and while you draw one, showing the ground as you go). Drag its top edge to resize it.
- **The table:** each structure's name, type, rim, invert in and invert out, then each pipe's size, material, length and slope. Blank rim = the ground surface at that spot. Blank invert out = same as in. Type a slope and the next invert is filled in. Enter moves down the column. Changing a structure's rim or type changes it on every run that shares it.
- **The picture:** ground (the run's **Depth from** surface, solid; other elevation surfaces dashed), structures from rim to invert, the pipe from invert to crown with length, size and slope, and the depth brackets as a colored strip along the bottom. Hover for station, ground, invert and depth (it's marked on the model and plan too); click a structure to jump to its row.
- **Depth from:** Auto uses the design surface; pick another elevation surface, or Rim to rim (straight). Depth is ground to invert.
- **Trench:** trench width (blank = pipe + 2 ft), bedding under the pipe (6″) and stone over the top (12″), and the depth brackets (10, 12, 14, 16, 18, 20 ft by default, matching the Depth Premium bid items).
- **Quantities:** pipe LF by size and material (the whole length, as you price it), **Depth premium** LF per bracket deeper than the first (10–12, 12–14 … 20+), structures by type (end sections and headwalls get the pipe size), manhole depth VF, trench excavation CY and bedding stone CY. Applied to an estimate, pipes and structures match bid items with the same words, and depth premiums match the Depth Premium item in the same category (Storm Drain or Sanitary Sewer). Excel adds **Pipes** and **Structures** sheets; the PDF lists every pipe.

**Quantities** (toolbar). Everything the takeoff measured: cut, fill, fill with compaction, export or import, stripping and site area from the last Cut / fill, and for each takeoff surface its total LF, SF, EA and section CY. Untick what you don't want, then:
- **Excel:** a Quantities sheet, an Items sheet (every line, area and count) and the Cut / fill settings and results.
- **PDF:** a printable page with the quantities and a picture of the model.
- **Apply to the estimate** (a bid's takeoff only): opens the bid's estimate and puts the quantities into **Import takeoff** as a “Takeoff workspace” report, with the same matching screen and remembered matches as the AGTEK import. Earthwork lines use the same names as AGTEK's (Cut, Fill, Export…), so matches made for AGTEK carry over. If the bid has no estimate yet, start one and the quantities are waiting.

Automatic suggestions in Import takeoff now only offer a bid item in the same unit, so a count is never added to a length.

Not built yet: crossing / out-of-sequence contour checks, DXF and LandXML into a surface, the tool chest (sectional areas, curb templates, pipe runs with profile) and the finish step (apply to the estimate, or export).
