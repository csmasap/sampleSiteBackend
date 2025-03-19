require('dotenv').config();
var Express = require("express");
var cors = require("cors");
const multer = require("multer");
const jsforce = require('jsforce');
const bodyParser = require('body-parser');

var app = Express();
app.use(cors());

app.use(bodyParser.json());

const conn = new jsforce.Connection(
    {loginUrl : 'https://login.salesforce.com'}
);

const salesforceUsername = process.env.SALESFORCE_USERNAME;
const salesforcePassword = process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN;

app.get('/', async () => {
    // return(res.send("Welcome"))
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    console.log(userInfo)
})


app.get('/getJobs', async (request,response) => {
    // return(res.send("Welcome"))
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    const result = await conn.query("Select Id,RecordTypeId, Opportunity_Discussed_Question_1__c, Opportunity_Discussed_Question_2__c, Opportunity_Discussed_Question_3__c, TR1__Status__c, Confidential_Search__c, Today_s_Priority__c, TR1__Open_Date__c, TR1__Division__c, TR1__Industry__c, TR1__State_Area__c, TR1__Regional_Area__c, TR1__City__c, Country__c, Post_Salary__c, TR1__Salary_Low__c, TR1__Salary_High__c, TR1__Job_Number__c, Type_of_work__c, TR1__Sourcing_Recruiter__c, Job_Public_Name__c, TR1__External_Job_Title__c,  TR1__Client_Description__c, TR1__Experience_Requirements__c, TR1__Education_Requirements__c, TR1__Responsibilities__c, LinkedIn_Post_URL__c, ASAP_Website_Link__c from TR1__Job__c WHERE (TR1__Status__c = 'Open' AND Confidential_Search__c = false)");
     
    //console.log(result);
    return(response.send(result));    
})

app.post('/updateJob', async (request,response) => {
    // return(res.send("Welcome"))
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    console.log(request.body);
    const { Id, answer } = request.body;
    const ret = await conn.sobject("TR1__Job__c").update({
        Id: Id,
        TR1__VMS_Last_Payload__c : answer     
      })
     
    console.log(ret);
    return(response.send(ret));    
})

app.listen(5038, ()=>{
    console.log(`server is running at 5038`)
})





