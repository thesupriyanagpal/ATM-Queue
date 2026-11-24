# ATM Queue Lab

**Project by Dr. Supriya Nagpal**

ATM Queue Lab is an interactive companion to *Queueing Model in a Bank ATM*. It uses a single-server M/M/1 model to explain how arrival rates and service capacity affect ATM utilization, queue length, and customer waiting across morning, afternoon, and evening.

## What you can explore

- Compare the three periods using the arrival and service rates reported in the study.
- Run the discrete-event simulation from an empty queue. Follow arrivals, completed visits, and simulated waiting times.
- Adjust demand and service capacity to see how the steady-state queue responds. The two moving-pointer charts illustrate how service capacity affects average queue length and how arrivals affect total visit time.
- Read the paper’s three original figures beside their published tables. The Probability Explorer computes the model probabilities from the reported rates, so its values can differ from the paper’s rounded values.
- Download probability and baseline results as CSV files from the page.

## Run locally

Open `public/index.html` in a browser. The app uses HTML, CSS, and JavaScript, with no dependencies, build step, API keys, or environment variables.

To serve it over HTTP using Python 3, run this from the repository root and open [http://localhost:8000](http://localhost:8000):

```bash
python -m http.server 8000 --directory public
```

## Project files

| Path | Contains |
| --- | --- |
| `public/index.html` | Page structure, study notes, and published tables |
| `public/styles.css` | Styling and responsive layouts |
| `public/app.js` | Queueing formulas, simulation, charts, and CSV exports |
| `public/assets/figures/` | The three figures from the paper |
| `vercel.json` | Static deployment configuration |

## Push to GitHub

Create an empty repository named `atm-queue-lab`, then run the commands below from the extracted `atm-queue-lab` folder. Replace `YOUR-USERNAME` with your GitHub username. These commands create two commits.

```bash
git init -b main
git add public/
git commit -m "Add interactive ATM Queue Lab"
git add README.md vercel.json .gitignore
git commit -m "Document the project and configure Vercel"
git remote add origin https://github.com/YOUR-USERNAME/atm-queue-lab.git
git push -u origin main
```

## Deploy on Vercel

1. In the Vercel dashboard, select **Add New → Project** and import your GitHub repository.
2. Use the **repository root** as the Root Directory. Keep `vercel.json` at that root.
3. The included configuration selects **Other**, skips installation and build, and serves the `public` directory. Check that the project uses `main` as its production branch.
4. Select **Deploy** and open the deployment URL. Check that the three published images load and that **Step event** advances the simulation from zero.

[Vercel guide to GitHub deployments](https://vercel.com/docs/git/vercel-for-github) · [Vercel static build settings](https://vercel.com/docs/builds/configure-a-build)

## Research source

Sonia Kalra and Supriya (2018). *Queueing Model in a Bank ATM*. International Journal of Research and Analytical Reviews, 5(4), 504–508. Article IJRAR1BIP089. Figures 1–3 are reproduced from the paper. The simulator and capacity scenarios illustrate the model using published period-level rates.

[Read the paper on ResearchGate](https://www.researchgate.net/publication/372478349_Queueing_Model_in_a_Bank_ATM)
