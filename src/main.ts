import * as core from '@actions/core';
import fs = require('fs');
import request = require('request-promise');

run();

async function run() {
  try {
    const requestData = await getRequestData();
    const jobUrl: string = await launchJob(requestData);
    const jobData = await getFinalStatus(requestData, jobUrl);
    const output = await printAnsibleOutput(requestData, jobData);
    await exportResourceName(output);
  }
  catch (err) {
    if (err instanceof SyntaxError) {
      console.log(err.message);
      core.setFailed("Extra vars invalid format, please provide a valid JSON.");
    } else {
      core.setFailed(err.message);
    }
  }
}

async function getRequestData() {

  const username: string = core.getInput('ansible-user');
  const password: string = core.getInput('ansible-pass');
  const url: string = 'https://tower.000ukso.sbp.eyclienthub.com/';
  const subscription: string = core.getInput('azure-subscription');
  const clientID: string = core.getInput('azure-client-id');
  const clientSecret: string = core.getInput('azure-client-secret');
  const additionalVars = JSON.parse(core.getInput('additional-vars'));
  const templateId: string = core.getInput('template-id');
  const certPath: string = core.getInput('certificate-path');
  let certBase64: any = null;
  const requestData: any = { extraVars: {}, templateId };

  if (certPath) {
    certBase64 = await base64_encode(certPath);
  }

  requestData.baseRequest = request.defaults({
    baseUrl: url,
    json: true,
    strictSSL: false,
    auth: {
      user: username,
      pass: password,
      sendImmediately: true
    }
  });

  requestData.extraVars.extra_vars = {
    ...(subscription != null && { var_azure_rm_subid: subscription }),
    ...(clientID != null && { AZURE_RM_CLIENTID: clientID }),
    ...(clientSecret != null && { AZURE_RM_SECRET: clientSecret }),
    ...(certBase64 != null && { var_applicationGatewayFrontEndSslCertData: certBase64 })
  };

  Object.assign(requestData.extraVars.extra_vars, additionalVars);

  const extraVarsToPrint = Object.assign({}, requestData.extraVars.extra_vars);
  if (certPath) {
    extraVarsToPrint.var_applicationGatewayFrontEndSslCertData = "*************";
  }

  console.log("Ansible Tower:", url);
  console.log("extra-vars: ");
  console.log(extraVarsToPrint);

  return requestData;
}

async function launchJob(requestData: any) {

  console.log(`Launching Template ID ${requestData.templateId} on Ansible Tower...`);

  const options = {
    method: "POST",
    url: `api/v2/job_templates/${requestData.templateId}/launch/`,
    body: requestData.extraVars
  };

  const response = await requestData.baseRequest(options);

  if (response && response.job) {
    console.log(`Template Id ${requestData.templateId} launched successfully.`);
    console.log(`Job ${response.job} was created on Ansible Tower: Status ${response.status}.`);
    return response.url;
  }
  else if (response && response.detail) {
    console.log(`Template ID ${requestData.templateId} couldn't be launched, the Ansible API is returning the following error:`);
    throw new Error(response.detail);
  }
  else {
    console.log(response);
    throw new Error(`Template ID ${requestData.templateId} couldn't be launched, the Ansible API is not working`);
  }
}

async function getFinalStatus(requestData: any, jobUrl: string) {

  const options = {
    url: jobUrl,
    method: "GET"
  };

  let response = await requestData.baseRequest(options);

  if (response && response.status) {
    if (!(response.status == "failed") && !(response.status == "successful") && !(response.status == "error")) {
      console.log("Validating Job status...");
      await wait(10000);
      console.log(`Job status: ${response.status}.`);
      response = await getFinalStatus(requestData, jobUrl);
      return response;
    } else {
      return response;
    }
  }
  else if (response && response.detail) {
    console.log("Failed to get job status from Ansible Tower.");
    throw new Error(response.detail);
  }
  else {
    console.log(response);
    throw new Error("Failed to get job status from Ansible Tower.");
  }
}

async function printAnsibleOutput(requestData: any, jobData: any) {

  const options = {
      url: `${jobData.related.stdout}?format=txt`,
      method: "GET",
      json: false,
  };

  const response = await requestData.baseRequest(options);

  if (jobData.status == "failed" && response) {
      console.log(`Final status: ${jobData.status}`);
      console.log("***************************Ansible Tower error output***************************");
      console.log(response);
      throw new Error(`Ansible tower job ${jobData.id} execution failed`);
  }
  else if (jobData.status == "error") {
      console.log(`Final status: ${jobData.status}`);
      console.log("***************************Ansible Tower error output***************************");
      console.log(response);
      console.log("***************************Ansible Tower traceback output***************************");
      console.log(jobData.result_traceback);
      throw new Error(`An error has ocurred on Ansible tower trying to launch job ${jobData.id}`);
  }
  else if (jobData.status == "successful" && response) {
      console.log(`Final status: ${jobData.status}`);
      console.log("******************************Ansible Tower output******************************");
      console.log(response);
  }
  else{
      console.log(`Final status: ${jobData.status}`);
      console.log("[warning]: An error ocurred trying to get the ansible tower output");
      console.log(response);
  }
  return response;
}

async function exportResourceName(output: string) {

  const regex = /(\/(\w+)\\)|(\/(\w+)")/g;
  const found = output.match(regex);

  if (found) {
      const resourceName = found[found.length - 1].substring(1, found[found.length - 1].length - 1);
      core.setOutput('RESOURCE_NAME', resourceName);
      console.log("Resource name exported: "+ resourceName);
  }
  else {
      console.log("[warning]: No resource name exported as output variable.");
  }
}

async function base64_encode(file: string) {

  const bitmap = fs.readFileSync(file);
  return new Buffer(bitmap).toString('base64');
}

async function wait(ms: any) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}