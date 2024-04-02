orders.txt

const { Order } = require('../models/order');
const express = require('express');
const { OrderItem } = require('../models/order-item');
const router = express.Router();
const { Product } = require('../models/product'); // Import the Product model
const nodemailer = require('nodemailer');
const { User } = require('../models/user'); // Import the User model
require('dotenv').config(); // Import dotenv to access environment variables


// Set up Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
    }
});

// Function to send emails
async function sendEmail(to, subject, text) {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: to,
            subject: subject,
            text: text
        });
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

router.get(`/`, async (req, res) => {
    const orderList = await Order.find().populate('user', 'name').sort({ 'dateOrdered': -1 });

    if (!orderList) {
        res.status(500).json({ success: false })
    }
   
    res.status(201).json(orderList)
})

router.get('/orderItems/:orderItemId', async (req, res) => {
    try {
        const orderItemId = req.params.orderItemId;
        const orderItem = await OrderItem.findById(orderItemId);
        if (!orderItem) {
            return res.status(404).json({ success: false, message: 'Order item not found' });
        }
        res.json({ success: true, product: orderItem.product }); // Return the product ID
    } catch (error) {
        console.error('Error fetching order item:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});


router.get(`/:id`, async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'name')
        .populate({
            path: 'orderItems', 
            populate: {
                path: 'product', populate: 'category'
            }
        });

    if (!order) {
        res.status(500).json({ success: false })
    } else {
        res.send(order);
    }
});


router.post('/', async (req, res) => {
    try {
        const { orderItems, shippingAddress1, shippingAddress2, city, zip, country, phone, status, user } = req.body;
        if (!Array.isArray(orderItems) || !shippingAddress1 || !city || !zip || !country || !phone || !status || !user) {
            console.error('Error placing order: Required fields missing or invalid');
            return res.status(400).json({ success: false, error: 'Required fields missing or invalid' });
        }

        // Calculate total price
        let totalPrice = 0;
        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            if (!product) {
                console.error(`Error placing order: Product with ID ${item.product} not found`);
                return res.status(400).json({ success: false, error: `Product with ID ${item.product} not found` });
            }
            totalPrice += product.price * item.quantity;
        }

        const orderItemsIds = [];
        for (const item of orderItems) {
            const newOrderItem = new OrderItem({
                quantity: item.quantity,
                product: item.product
            });
            const savedOrderItem = await newOrderItem.save();
            orderItemsIds.push(savedOrderItem._id);
        }

        const order = new Order({
            orderItems: orderItemsIds,
            shippingAddress1,
            shippingAddress2,
            city,
            zip,
            country,
            phone,
            status,
            totalPrice, // Include total price in the order object
            user
        });

        const savedOrder = await order.save();

        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            if (product) {
                product.countInStock -= item.quantity;
                await product.save(); // Save the updated product document
            }
        }

        // Send email confirmation
        const subject = 'Order Confirmation';
        let text = `Dear Customer,\n\nThank you for your purchase. We appreciate your business!\n\nYour order details:\n`;
        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            text += `\nProduct: ${product.name}\nPrice: ${product.price}\nQuantity: ${item.quantity}\nTotal: ${product.price * item.quantity}\n`;
        }
        text += `\nIf you have any questions or concerns, please feel free to contact us.\n\nRegards,\nApplitech`;

        await sendEmail('customer@example.com', subject, text);

        res.status(201).json(savedOrder);
    } catch (error) {
        console.error('Error placing order:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    const order = await Order.findByIdAndUpdate(
        req.params.id,
        {
            status: req.body.status
        },
        { new: true }
    )

    if (!order)
        return res.status(400).send('the order cannot be update!')

    res.send(order);
})

router.delete('/:id', (req, res) => {
    Order.findByIdAndRemove(req.params.id).then(async order => {
        if (order) {
            await order.orderItems.map(async orderItem => {
                await OrderItem.findByIdAndRemove(orderItem)
            })
            return res.status(200).json({ success: true, message: 'the order is deleted!' })
        } else {
            return res.status(404).json({ success: false, message: "order not found!" })
        }
    }).catch(err => {
        return res.status(500).json({ success: false, error: err })
    })
})

router.get('/get/totalsales', async (req, res) => {
    const totalSales = await Order.aggregate([
        { $group: { _id: null, totalsales: { $sum: '$totalPrice' } } }
    ])

    if (!totalSales) {
        return res.status(400).send('The order sales cannot be generated')
    }

    res.send({ totalsales: totalSales.pop().totalsales })
})

router.get(`/get/count`, async (req, res) => {
    const orderCount = await Order.countDocuments((count) => count)

    if (!orderCount) {
        res.status(500).json({ success: false })
    }
    res.send({
        orderCount: orderCount
    });
})

router.get(`/get/userorders/:userid`, async (req, res) => {
    const userOrderList = await Order.find({ user: req.params.userid }).populate({
        path: 'orderItems', populate: {
            path: 'product', populate: 'category'
        }
    }).sort({ 'dateOrdered': -1 });

    if (!userOrderList) {
        res.status(500).json({ success: false })
    }
    res.send(userOrderList);
})

module.exports = router;