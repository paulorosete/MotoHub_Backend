const { Category } = require('../models/category');
const express = require('express');
const router = express.Router();
const multer = require('multer');

const FILE_TYPE_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg'
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const isValid = FILE_TYPE_MAP[file.mimetype];
        let uploadError = new Error('invalid image type');

        if (isValid) {
            uploadError = null;
        }
        cb(uploadError, 'public/uploads');
    },
    filename: function (req, file, cb) {
        const fileName = file.originalname.split(' ').join('-');
        const extension = FILE_TYPE_MAP[file.mimetype];
        cb(null, `${fileName}-${Date.now()}.${extension}`);
    }
});

const uploadOptions = multer({ storage: storage });

router.get(`/`, async (req, res) => {
    const categoryList = await Category.find();

    if (!categoryList) {
        res.status(500).json({ success: false })
    }
    res.status(200).send(categoryList);
})

router.get('/:id', async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        res.status(500).json({ message: 'The category with the given ID was not found.' })
    }
    res.status(200).send(category);
})

// router.post('/', async (req, res) => {
//     console.log(req)
//     let category = new Category({
//         name: req.body.name,
//         icon: req.body.icon,
//         color: req.body.color
//     })
//     category = await category.save();

//     if (!category)
//         return res.status(400).send('the category cannot be created!')

//     res.send(category);
// })

router.post(`/`, uploadOptions.single('image'), async (req, res) => {
    // Get the category name from the request body
    const categoryName = req.body.name;
    const basePath = `${req.protocol}://${req.get('host')}/public/uploads/`;

    if (!categoryName) {
        return res.status(400).send('Category name is required');
    }

    let category = new Category({
        name: categoryName,
        image: req.file ? `${basePath}${req.file.filename}` : null,
    });

    try {
        category = await category.save();
        res.status(200).send(category);
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.put('/:id', uploadOptions.single('image'), async (req, res) => {
    try {
        let imagepath;

        if (req.file) {
            const fileName = req.file.filename;
            const basePath = `${req.protocol}://${req.get('host')}/public/uploads/`;
            imagepath = `${basePath}${fileName}`;
        } else {
            // If no new image is provided, retain the existing image path
            const category = await Category.findById(req.params.id);
            if (!category) {
                return res.status(404).send('Category not found');
            }
            imagepath = category.image;
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            {
                // Update category name if provided
                ...(req.body.name && { name: req.body.name }),
                image: imagepath
            },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(400).send('The category could not be updated');
        }

        res.send(updatedCategory);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).send('Error updating category');
    }
});



router.delete('/:id', (req, res) => {
    Category.findByIdAndRemove(req.params.id).then(category => {
        if (category) {
            return res.status(200).json({ success: true, message: 'the category is deleted!' })
        } else {
            return res.status(404).json({ success: false, message: "category not found!" })
        }
    }).catch(err => {
        return res.status(500).json({ success: false, error: err })
    })
})

module.exports = router;