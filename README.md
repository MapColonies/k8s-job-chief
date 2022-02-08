
# K8S job-chief

Simple service for triggering Jobs based on an external queue.

## Motive
There are other Open-Source tools that very similiar to this one, but their main disadvangtge is permissions.
Usually they require stuff like CRD, ClusterRole, or they are Operators, which limits the environments where They can be deployed.
In comparison, job-chief only requires permissions over the Jobs and Pods in the same namespace.

## How it works
When starting the service, all the jobs are loaded into memory based on a configration file.
Each job will check whether the queue for this specific job contain any items, and if it does, will spawn a Job in the kubernetes cluster.
While the job is active, the service tracks the status of the job and its pods. If the job fails to start it will be detected, and the job will start again after a certain time as defined in the job configuration.

After the job is completed, the entire process will repeat itself after waiting for a certain period.

## Queues
Currently the only queue support is [pg-boss](https://github.com/timgit/pg-boss) (postgres based queue).

## Configuration
### Service level
```json
{
  "app": {
    "instanceUid": "aaaaaa", // unique Id that is used to differentiate between different instances running on the same namespace
    "jobsConfigPath": "./jobs.json" // the path from which the jobs configuration file will be loaded
  },
  "db": { // PG settings. all those settings will also be injected into the jobs
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "postgres",
    "schema": "pgboss",
    "monitorStateIntervalSeconds": 30, // this interval decides when statistics about the queues will be updated
    "enableSslAuth": false,
    "sslPaths": {
      "ca": "",
      "key": "",
      "cert": ""
    },
    "database": "postgres",
    "certSecretName": "" // name of the secret that contains all of the certificates required for ssl authentication
  },
  "kubernetes": {
    "namespace": "default", // the namespace in which the Jobs will be spawned (should be the same as service normally)
    "loadConfigFromCluster": false, // wheter to use default credentials for k8s api, or load from the cluster
    "pullSecret": "" // the pull secret to use when creating new jobs
  }
}

```
### Job level
The configuration for the jobs are stored in a json file that contains an array of jobs.
Each job structure is as follows:
```json
[
  {
    "queueName": "avi",
    "podConfig": {
      "parallelism": 1, // number of pods the job will spawn
      "image": "imageName",
      "command": ["do", "action"], // optional
      "args" ["-l"], //optional
      "injectPgConfig": false, // whether the job will be injected with the PG env varibles
      "env": [{ "name": "NAME", "value": "value" }], // optional
      "configmaps": [], // optional array of configmaps that will be added as ENV to the job
      "secrets": [], // optional array of secrets that will be added as ENV to the job
      "resources": { "limits":{"cpu": "500m", "memory":"128mi"}, "requests":{"cpu": "500m", "memory":"128mi"}} // optional
      "liveness": {
        "enabled": false
        "path": "/liveness"
        "port": 1337,
        "initialDelaySeconds": 30,
        "periodSeconds": 30,
        "timeoutSeconds" 60,
      },
      "pullPolicy": "Never", // 'Always' | 'IfNotPresent' | 'Never'
    },
    "waitTimeAfterSuccessfulRun": "5s", // The service will wait the specified amount of time after a successful run
    "queueCheckInterval": "55s", // wait time between checks of the queue size
    "jobStartTimeout": "1m", // how long to let a job start before declaring it as failed
    "waitTimeAfterTimeout": "5s", // wait time after the job fails because of the start timeout
    "waitTimeAfterError": "15s", // wait time after the job fails because of an error
    "waitTimeAfterFailedRun": "10s" // wait time after the job is marked as failed by the kubernetes API 
  }
]

```

