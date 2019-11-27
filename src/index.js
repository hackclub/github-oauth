import express from 'express'
import { request } from '@octokit/request'

const env = process.env.NODE_ENV || 'development'
if (env === 'development') {
  require('dotenv').config()
}

const app = express()

const ghAuth = async (req) => {
  const code = req.query.code
  if (!code) {
    throw new Error(`I got an auth request without an access token`)
  }

  const authResponse = await request(
    'POST https://github.com/login/oauth/access_token',
    {
      headers: { Accept: 'application/json' },
      data: {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      }
    }
  )

  const token = authResponse.data.access_token

  const userResponse = await request('GET /user', {
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
  let destinationUrl = 'https://airtable.com/shrNMxeoANyxtVY8U'
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

app.get('/dinoissour-badge', async(req, res) => {
  let destinationUrl = 'https://excitedcornsilkpackages.now.sh'

  try {
    const authData = await ghAuth(req)

    const teamID = 3542087

    const orgUsername = process.env.GITHUB_ADMIN_USERNAME
    const orgToken = process.env.GITHUB_ADMIN_TOKEN
    const token = Buffer.from(orgUsername + ':' + orgToken).toString('base64')

    const invite = await request(`PUT /teams/:team_id/memberships/:username`, {
      headers: { Authorization: `Basic ${token}` },
      team_id: teamID,
      username: authData.user.login,
      role: 'member'
    })

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
