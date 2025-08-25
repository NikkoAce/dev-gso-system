const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configure the S3 client
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Helper function to upload a file buffer to S3
const uploadToS3 = async (file, assetId, title, folder = 'attachments') => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const key = `${folder}/${assetId}/${uniqueSuffix}-${file.originalname}`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    await s3.send(command);

    return {
        key: key, // Only store the key in DB
        title: title || file.originalname, // Use provided title or fallback to original name
        originalName: file.originalname,
        mimeType: file.mimetype,
    };
};

// Helper function to generate a pre-signed URL for a private S3 object
const generatePresignedUrl = async (key, expiresIn = 3600) => { // expiresIn in seconds (default 1 hour)
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    });
    return getSignedUrl(s3, command, { expiresIn });
};

module.exports = {
    uploadToS3,
    generatePresignedUrl, // Export the new function
    s3, DeleteObjectCommand
};
