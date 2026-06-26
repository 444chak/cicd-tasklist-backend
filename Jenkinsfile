pipeline {
  agent any

  triggers {
    pollSCM('H/2 * * * *')
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    disableConcurrentBuilds()
  }

  environment {
    NODE_ENV = 'test'
    IMAGE_NAME = 'tasklist-backend'
    DOCKERHUB_CREDENTIALS_ID = '444chak-dockerhub-password'
    SONAR_CREDENTIALS_ID = '444chak-sonar-token'
    SONARQUBE_INSTALLATION = 'SonarQube'
  }

  stages {
    stage('Install dependencies') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Generate Prisma client') {
      steps {
        sh 'npx prisma generate'
      }
    }

    stage('Unit tests') {
      steps {
        sh 'npm run test:coverage'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/junit.xml'
        }
      }
    }

    stage('End-to-end tests') {
      steps {
        sh 'npm run test:e2e'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/junit.xml'
        }
      }
    }

    stage('SonarQube analysis') {
      steps {
        withSonarQubeEnv(env.SONARQUBE_INSTALLATION) {
          withCredentials([string(credentialsId: env.SONAR_CREDENTIALS_ID, variable: 'SONAR_TOKEN')]) {
            sh 'sonar-scanner -Dsonar.token="$SONAR_TOKEN"'
          }
        }
      }
    }

    stage('SonarQube Quality Gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Build Docker image') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS_ID, usernameVariable: 'DOCKERHUB_USERNAME', passwordVariable: 'DOCKERHUB_PASSWORD')]) {
          script {
            env.DOCKER_IMAGE = "${env.DOCKERHUB_USERNAME}/${env.IMAGE_NAME}:${env.BUILD_NUMBER}"
            env.DOCKER_LATEST = "${env.DOCKERHUB_USERNAME}/${env.IMAGE_NAME}:latest"
          }
          sh '''
            docker build --target runtime -t "$DOCKER_IMAGE" -t "$DOCKER_LATEST" .
          '''
        }
      }
    }

    stage('Generate security reports') {
      steps {
        sh '''
          mkdir -p reports/security
          trivy image --format json --output reports/security/trivy-image.json --severity HIGH,CRITICAL --exit-code 0 "$DOCKER_IMAGE"
          trivy image --format table --output reports/security/trivy-image.txt --severity HIGH,CRITICAL --exit-code 0 "$DOCKER_IMAGE"
        '''
      }
      post {
        always {
          archiveArtifacts allowEmptyArchive: true, artifacts: 'reports/security/trivy-image.*'
        }
      }
    }

    stage('Generate SBOM') {
      steps {
        sh '''
          mkdir -p reports/sbom
          trivy image --format cyclonedx --output reports/sbom/sbom-cyclonedx.json "$DOCKER_IMAGE"
          trivy image --format spdx-json --output reports/sbom/sbom-spdx.json "$DOCKER_IMAGE"
        '''
      }
      post {
        always {
          archiveArtifacts allowEmptyArchive: true, artifacts: 'reports/sbom/*.json'
        }
      }
    }

    stage('Trivy vulnerability gate') {
      steps {
        sh 'trivy image --severity HIGH,CRITICAL --exit-code 1 "$DOCKER_IMAGE"'
      }
    }

    stage('Publish Docker image') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS_ID, usernameVariable: 'DOCKERHUB_USERNAME', passwordVariable: 'DOCKERHUB_PASSWORD')]) {
          sh '''
            echo "$DOCKERHUB_PASSWORD" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin
            docker push "$DOCKER_IMAGE"
            docker push "$DOCKER_LATEST"
            docker logout
          '''
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts allowEmptyArchive: true, artifacts: 'coverage/lcov.info,reports/junit.xml'
      cleanWs()
    }
  }
}
