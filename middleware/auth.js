import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
    try {
        const token = req.header("auth-token");
        console.log(`header token: ${token}`);
        jwt.verify(token, process.env.SECRET_KEY);
        next();
    }
    catch (err) {
        res.send({error: err.message});
    }
}