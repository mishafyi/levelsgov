# LevelsGov

**Open-source federal workforce intelligence.** Browse, explore, and visualize U.S. federal employee compensation and workforce data from the Office of Personnel Management (OPM).

**[levelsgov.com](https://levelsgov.com)**

---

## What is this?

LevelsGov makes OPM FedScope data accessible and understandable. Instead of downloading bulk CSV files from OPM, you get an interactive dashboard with search, filters, and visualizations covering **2M+ federal employee records** across every agency, occupation, and state.

Think of it as [levels.fyi](https://levels.fyi) but for the federal government.

## Features

### Dashboard
- Key workforce stats: total employees, median pay, agency count, new hires, net change
- Interactive choropleth map of federal pay by state
- Top paying agencies and occupations
- Pay breakdowns by tenure, education, age, and STEM classification
- GS grade distribution, work schedule breakdown, supervisory pay gap
- Workforce trend analysis: separation reasons, agency changes, STEM brain drain

### Employment Browser
- Search and filter the full federal workforce dataset
- Filter by agency, state, occupation, grade, pay plan, education, age, work schedule, and more
- Sortable, paginated results

### New Hires & Departures
- Browse accession and separation records with the same filter capabilities
- Understand who's joining and leaving federal service, and why

### AI Exposure
- Interactive treemap of 500+ federal occupations sized by headcount and colored by AI exposure score
- Demographic breakdowns (age, education) for each occupation
- Custom scoring methodology based on digital work, routine cognition, interpersonal labor, and regulatory criticality

### Org Chart
- Hierarchical view of the federal government structure
- Cabinet departments, military branches, independent agencies, legislative and judicial branches
- Agency subelements with headcount data

## Tech Stack

- **Framework:** Next.js 16 (React 19, TypeScript)
- **Database:** PostgreSQL
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Charts:** Recharts, react-simple-maps
- **Deployment:** Docker, Coolify (self-hosted)

## Data Source

All workforce data comes from the [OPM FedScope](https://www.opm.gov/data/datasets/#checks=employment-full) public dataset. AI exposure scores are generated using a custom methodology documented in the repository.

## Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL with FedScope data loaded

### Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

### Environment Variables

Create a `.env.local` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/fedwork
```

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t levelsgov .
docker run -p 3000:3000 --env-file .env.local levelsgov
```

## License

MIT
