# Student Attendance Management System Using DevOps Tools

A starter project built with HTML/CSS/JavaScript, Node.js/Express, built-in Node.js SQLite, Git/GitHub, Jenkins, Docker, Kubernetes, and Selenium.

## Prerequisites
- Node.js 22 or newer (the project uses the built-in `node:sqlite` module; Node.js 26 is supported)
- Git
- VS Code
- Optional later: Docker Desktop, Jenkins, Kubernetes (Docker Desktop Kubernetes or Minikube), Chrome

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000. The app seeds five sample students on first launch. Replace these with your actual class list.

## Features
- Daily attendance for seven periods per student
- Mark all present / absent
- Date-wise persistent attendance records
- Monthly report and configurable threshold
- CSV export
- Add students
- Health endpoint at `/api/health`

## Important calculation note
The monthly report counts recorded attendance cells (P or A) as working periods. An unmarked cell is not counted. Mark all periods for each actual working day to get an accurate report. If your college has holidays or cancelled periods, do not mark those periods.

## Tests
```bash
npm test
```
Optional Selenium smoke test:
```bash
npm run dev
# In another terminal:
node tests/selenium-smoke.js
```
The Selenium test requires Chrome and a compatible driver available to Selenium.

## Docker
```bash
docker compose up --build
```
Open http://localhost:3000. The SQLite database is stored in a Docker named volume.

## GitHub
Create an empty repository on GitHub, then:
```bash
git init
git add .
git commit -m "Initial attendance management system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/student-attendance-devops.git
git push -u origin main
```
Replace `YOUR-USERNAME` with your GitHub username. Do not commit credentials or `.env` files.

## Jenkins
Create a Jenkins Pipeline job connected to the GitHub repository. Configure a NodeJS installation named `NodeJS20` in Jenkins Global Tool Configuration and ensure the Jenkins agent has Docker access. Then select “Pipeline script from SCM” and point it to this repository. The included Jenkinsfile is a starter; adapt the tool name to your Jenkins setup.

## Kubernetes
Build and load the image into your local cluster, then apply the manifests:
```bash
docker build -t student-attendance:latest .
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl get pods,svc
```
For Docker Desktop Kubernetes, `student-attendance:latest` can be available locally. Other clusters require pushing the image to a registry and changing the image field. For a local NodePort service, use `kubectl port-forward service/student-attendance 8080:80` and visit http://localhost:8080.

**Prototype limitation:** this starter does not include login/role-based authorization, student editing/deactivation, or a real institutional calendar. Add authentication and authorization before using real student records. The built-in `node:sqlite` module avoids native addon compilation. SQLite is suitable for a local demonstration; production/multi-replica deployment should use a managed database rather than a separate SQLite file per pod.
