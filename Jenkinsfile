
pipeline {
    agent any

    tools {
        nodejs 'NodeJS22'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Node.js') {
            steps {
                sh 'node --version'
                sh 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Validate') {
            steps {
                sh 'node --check server.js'
                sh 'node --check public/app.js'
            }
        }

        stage('Tests') {
            steps {
                sh 'npm test'
            }
        }
    }

    post {
        always {
            echo 'Attendance system pipeline finished.'
        }
    }
}

