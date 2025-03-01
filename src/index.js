import express from 'express'
import Airtable from 'airtable'
import fetch from 'node-fetch'

const { Octokit } = require("octokit");

const env = process.env.NODE_ENV || 'development'
if (env === 'development') {
  require('dotenv').config()
}

const octokit = new Octokit({
  auth: process.env.GITHUB_FOR_DINOISSEUR_PAT
});

/* Configure Airtable */
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY
})

const SDP_BASE_ID = 'apple9fiV81JsRytC' // Base ID for "SDP Priority Activations" base
const base = Airtable.base(SDP_BASE_ID);

const app = express()

const ghAuth = async (req) => {
  const code = req.query.code
  if (!code) {
    throw new Error(`I got an auth request without an access token`)
  }

  const authResponse = await octokit.request(
    'POST https://github.com/login/oauth/access_token',
    {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
    }
  )

  const token = authResponse.data.access_token

  const userResponse = await octokit.request('GET /user', {
    headers: { Authorization: `token ${token}` }
  })

  console.log('Successfully authed', userResponse.data.login, 'for the url', req.url)
  if (userResponse.headers['x-oauth-scopes']) {
    console.log(userResponse.data.login, 'has added the following scopes: ', userResponse.headers['x-oauth-scopes'])
  }

  return {
    token,
    user: userResponse.data,
  }
}

const objectToQueryString = obj => {
  let result = ''
  const kvArray = Object.keys(obj).filter(k => obj[k] && obj[k] != 'null').map(k => 
    `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`
  )
  if (kvArray.length > 0) {
    result += '?'
    result += kvArray.join('&')
  }
  return result
}

app.get('/hack-pack', async (req, res) => {
  let destinationUrl = 'https://airtable.com/shru4fEbdqDMXoYEE'
  try {
    const authData = await ghAuth(req)

    const { login: username = '', email = '' } = authData.user

    destinationUrl += objectToQueryString({
      'prefill_GitHub Username': username,
      'prefill_GitHub Email': email
    })
  } catch (e) {
    console.error(e)
  } finally {
    res.redirect(302, destinationUrl)
  }
})

app.get('/generate-account', async (req, res) => {
  try {
    const recordId = req.query.recordId;
    /* Check if person is already there */

    // Get user record
    const record = base('SDP Priority Activations').find(recordId);
    const userName = (await record).get('GitHub Username')
    const status = (await record).get('Approved')

    // If they have used the URL already, send them to pack.

    if (status === true){
      res.redirect(302, 'https://education.github.com/pack')
      return
    }

    const isApproved = await base('SDP Priority Activations').select({
      filterByFormula: `AND({GitHub Username} = "${userName}", {Approved} = TRUE(), {Years Since} <= 2)`
    }).all()

    /* Check if there isn't a previous record that has been approved 
       in the past two years (standard validation period) for this user */
    if (isApproved.length !== 0) {
      console.log('Previous record found');
      res.redirect(302, 'https://education.github.com/pack') // They already had one, so send them there!
      /* Set not approved for duplicate */
      await base('SDP Priority Activations').update([{
        id: recordId,
        fields: {
          'Rejection Reason': 'Duplicate Airtable submission'
        }
      }])
      return;
    }

    /* Update record for "Approved" */
    await base('SDP Priority Activations').update([{
      id: recordId,
      fields: {
        'Approved': true
      }
    }])


    /* Generate special link */
    const activateRequest = await fetch(`https://education.github.com/student/verify/generate?school_id=27876&student_id=${recordId}&secret_key=${process.env.GITHUB_EDU_SECRET}`)

    /* Redirect to special link */
    res.redirect(302, await activateRequest.text());
} catch (err) {
  console.error(err);
}
})

app.get('/dinoissour-badge', async(req, res) => {
  let destinationUrl = req.query.destination ?? 'https://draw-dino.hackclub.com'

  try {
    const authData = await ghAuth(req)
    console.log("auth data", authData);
    console.log("user login", authData.user.login);

    const invite = await octokit.request('PUT /orgs/{org}/teams/{team_slug}/memberships/{username}', {
      org: 'hackclub',
      team_slug: "Dinoisseurs",
      username: authData.user.login,
      role: 'member',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    destinationUrl += objectToQueryString({ username: authData.user.login, inviteStatus: invite.data.state })

  } catch (e) {
    console.error(e)
  } finally {
    res.redirect(302, destinationUrl)
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log('Starting to listen on port', port)
})
