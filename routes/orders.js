const { Order } = require('../models/order');
const express = require('express');
const { OrderItem } = require('../models/order-item');
const router = express.Router();
const { Product } = require('../models/product');
const { User } = require('../models/user');
require('dotenv').config();
const nodemailer = require('nodemailer');

//una
var transporter = nodemailer.createTransport({
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

router.get(`/:id`, async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'name')
        .populate({
            path: 'orderItems', 
            populate: {
                path: 'product', 
                populate: 'category'
            }
        });

    if (!order) {
        res.status(500).json({ success: false })
    }
    res.send(order);
})

router.post('/', async (req, res) => {
    try {
        const orderItemsIds = await Promise.all(req.body.orderItems.map(async (orderItem) => {
            let newOrderItem = new OrderItem({
                quantity: orderItem.quantity,
                product: orderItem.product
            });
            newOrderItem = await newOrderItem.save();
            return newOrderItem._id;
        }));

        const orderItemsIdsResolved = await orderItemsIds;

        let order = new Order({
            orderItems: orderItemsIdsResolved,
            shippingAddress1: req.body.shippingAddress1,
            shippingAddress2: req.body.shippingAddress2,
            city: req.body.city,
            zip: req.body.zip,
            country: req.body.country,
            phone: req.body.phone,
            status: req.body.status,
            user: req.body.user,
        });

        order = await order.save();

        // Retrieve orderItems from the order object
        const orderItems = await OrderItem.find({ _id: { $in: order.orderItems } }).populate('product');

        // Send email confirmation
        const subject = 'Order Confirmation';
        let text = `Dear Customer,\n\nThank you for your purchase. We appreciate your business!\n\nWe hope you enjoy our product!!:\n`;
        for (const item of orderItems) {
            
            text += `MOTOHUB PRODUCT\n\n Kyt Helmet\n`;
        }

        text += `\nIf you have any questions or concerns, please feel free to contact us.\n\nRegards,\nMotoGear PH`;

        await sendEmail('customer@gmail.com', subject, text);

        res.status(201).json(order);

        if (!order)
            return res.status(400).send('the order cannot be created!')
    } catch (error) {
        console.error('Error creating order:', error);
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