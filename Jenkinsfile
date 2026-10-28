pipeline {
  agent any
  tools {
    nodejs 'NodeJS20'
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Install') {
      steps { sh 'npm install' }
    }
    stage('Validate') {
      steps { sh 'node --check server.js && node --check public/app.js' }
    }
    stage('Tests') {
      steps { sh 'npm test' }
    }
    stage('Build Docker image') {
      steps { sh 'docker build -t student-attendance:${BUILD_NUMBER} .' }
    }
  }
  post {
    always { echo 'Attendance system pipeline finished.' }
  }
}
