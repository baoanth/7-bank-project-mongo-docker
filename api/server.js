const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors')
const crypto = require('crypto');
const pkg = require('./package.json');
const mongoose = require('mongoose');

// App constants
const port = process.env.PORT || 5000;
const apiPrefix = '/api';

const Schema = mongoose.Schema;

const User = new Schema({
    user: String,
    currency: String,
    description: String,
    balance: Number,
    transactions: Array
});

let UserModel

mongoose.connect('mongodb://mongo:27017/7-bank-project')
  .then((conn) => {
    console.log('Connected!')
    UserModel = conn.model('User', User);
  })
  

// Store data in-memory, not suited for production use!

// Create the Express app & setup middlewares
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({ origin: /http:\/\/(127(\.\d){3}|localhost)/}));
app.options('*', cors());

// ***************************************************************************

// Configure routes
const router = express.Router();

// Get server infos
router.get('/', (req, res) => {
  return res.send(`${pkg.description} v${pkg.version}`);
});

// ----------------------------------------------

// Create an account
router.post('/accounts', async (req, res) => {
  // Check mandatory request parameters
  if (!req.body.user || !req.body.currency) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  const userCheck = await UserModel.findOne({user: req.params.user})
  // Check if account already exists
  if (userCheck) {
    return res.status(409).json({ error: 'User already exists' });
  }

  console.log(userCheck);

  // Convert balance to number if needed
  let balance = req.body.balance;
  if (balance && typeof balance !== 'number') {
    balance = parseFloat(balance);
    if (isNaN(balance)) {
      return res.status(400).json({ error: 'Balance must be a number' });  
    }
  }

  // Create account
  const account = {
    user: req.body.user,
    currency: req.body.currency,
    description: req.body.description || `${req.body.user}'s budget`,
    balance: balance || 0,
    transactions: [],
  };

  const user = new UserModel(account)
  user.save()
  return res.status(201).json(account);
});

// ----------------------------------------------

// Get all data for the specified account
router.get('/accounts/:user', async (req, res) => {
  const account = await UserModel.findOne({user: req.params.user})

  // Check if account exists
  if (!account) {
    return res.status(404).json({ error: 'User does not exist' });
  }

  return res.json(account);
});

// ----------------------------------------------

// Remove specified account
router.delete('/accounts/:user', async (req, res) => {
  const account = await UserModel.findOneAndDelete({user: req.params.user})

  return res.sendStatus(204);
  // // Check if account exists
  // if (!account) {
  //   return res.status(404).json({ error: 'User does not exist' });
  // }
});

// ----------------------------------------------

// Add a transaction to a specific account
router.post('/accounts/:user/transactions', async (req, res) => {
  const account = await UserModel.findOne({user: req.params.user})

  // Check if account exists
  if (!account) {
    return res.status(404).json({ error: 'User does not exist' });
  }

  // Check mandatory requests parameters
  if (!req.body.date || !req.body.object || !req.body.amount) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  // Convert amount to number if needed
  let amount = req.body.amount;
  if (amount && typeof amount !== 'number') {
    amount = parseFloat(amount);
  }

  // Check that amount is a valid number
  if (amount && isNaN(amount)) {
    return res.status(400).json({ error: 'Amount must be a number' });
  }

  // Generates an ID for the transaction
  const id = crypto
    .createHash('md5')
    .update(req.body.date + req.body.object + req.body.amount)
    .digest('hex');

  // Check that transaction does not already exist
  if (account.transactions.some((transaction) => transaction.id === id)) {
    return res.status(409).json({ error: 'Transaction already exists' });
  }

  // Add transaction
  const transaction = {
    id,
    date: req.body.date,
    object: req.body.object,
    amount,
  };
  account.transactions.push(transaction);

  // Update balance
  account.balance += transaction.amount;

  account.save()

  return res.status(201).json(transaction);
});

// ----------------------------------------------

// Remove specified transaction from account
router.delete('/accounts/:user/transactions/:id', async (req, res) => {
  const account = await UserModel.findOne({user: req.params.user})

  // Check if account exists
  if (!account) {
    return res.status(404).json({ error: 'User does not exist' });
  }

  const transactionIndex = account.transactions.findIndex(
    (transaction) => transaction.id === req.params.id
  );

  // Check if transaction exists
  if (transactionIndex === -1) {
    return res.status(404).json({ error: 'Transaction does not exist' });
  }

  // Remove transaction
  account.transactions.splice(transactionIndex, 1);

  account.save()

  res.sendStatus(204);
});

// ***************************************************************************

// Add 'api` prefix to all routes
app.use(apiPrefix, router);

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
