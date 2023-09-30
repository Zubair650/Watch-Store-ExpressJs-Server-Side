const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken')
app.use(express.json())
app.use(cors())
require('dotenv').config();


const stripe = require('stripe')('sk_test_51NGgFvLcoB7sJJ009JnwzBKb8uWsnrfYN7XrfgY1Xto65vmsW2iDujkm3WRgjSB0zeBQ8HtmvtrNlFaL6qXbWfe700lpz8d868');


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5i6b38m.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// watch-express
//wNIyhPE79VFXFkuH
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    // console.log('unauthorized')
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}
async function run() {
  try {

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const watchCollection = client.db('watch-express').collection('watches');
    const userCollection = client.db('watch-express').collection('users');
    const orderCollection = client.db('watch-express').collection('orders');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1hr'
      });
      res.send({ token });
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    app.get('/watches', async (req, res) => {
      const result = await watchCollection.find().toArray()
      res.send(result);
    })

    app.post('/watches', async (req, res) => {

      const watches = req.body;
      const result = await watchCollection.insertOne(watches);
      res.send(result)
    })

    app.post('/orderWatch', async (req, res) => {
      const orderWatch = req.body;
      console.log('ordered coffee', orderWatch)
      const result = await orderCollection.insertOne(orderWatch);
      res.send(result);
    })

    app.get('/orderWatch', verifyJWT, async (req, res) => {

      const decoded = req.decoded;
      console.log('Came after verify', decoded)
      if (decoded.email != req.query.email) {
        return res.status(403).send({ error: 1, message: 'forbidden access' })
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const cursor = orderCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/users', async (req, res) => {

      const users = await userCollection.find().toArray();
      return res.send(users);
    })

    app.post('/users', async (req, res) => {
      const users = req.body;
      // const query = { email: users.email }
      // const existingUser = await userCollection.find(query)
      // console.log(existingUser, 'already exists')
      // if(existingUser)
      // {
      //   return res.send({message:'use already exists'})
      // }
      const result = await userCollection.insertOne(users);
      return res.send(users)
    })

    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      return res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      return res.send(result);
    })

    /////////payment/////////

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Watches are coming');
})

app.post('/create-payment-intent', async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // Replace with the desired amount in cents
      currency: 'usd',
      // Add additional options as needed
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`The port number is ${port}`);
})