require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const { engine } = require("express-handlebars");

const {
  connectDatabases,
  getReadDb,
  getWriteDb,
  getWriteClient,
  closeDatabases
} = require("./db");

const app = express();

const PORT = Number(
  process.env.PORT || 3000
);

const MSSV =
  process.env.MSSV || "23IT279";

const FULL_NAME =
  process.env.FULL_NAME ||
  "Đặng Kiều Trang";

const DB_NAME =
  process.env.DB_NAME ||
  "DB_23IT279";

const PRODUCT_PREFIX =
  MSSV.slice(-3);

const LAST_DIGIT =
  Number(MSSV.slice(-1));

const VAT_PERCENT =
  LAST_DIGIT + 5;

const VAT_RATE =
  VAT_PERCENT / 100;

if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is missing in .env"
  );
}

// --------------------------------------------------
// Express
// --------------------------------------------------

app.set("trust proxy", 1);

app.engine(
  "handlebars",
  engine({
    helpers: {
      currency(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
          return "0 ₫";
        }

        return new Intl.NumberFormat(
          "vi-VN",
          {
            style: "currency",
            currency: "VND"
          }
        ).format(number);
      }
    }
  })
);

app.set(
  "view engine",
  "handlebars"
);

app.set(
  "views",
  path.join(__dirname, "views")
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.json()
);

app.use(
  express.static(
    path.join(
      __dirname,
      "..",
      "public"
    )
  )
);

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get(
  "/health",
  (req, res) => {
    res.status(200).json({
      status: "ok",
      app: "book-cloud-23it279",
      database: DB_NAME,
      mssv: MSSV,
      vat: `${VAT_PERCENT}%`
    });
  }
);

// --------------------------------------------------
// Session middleware
//
// Important:
// MongoStore is initialized only AFTER
// MongoDB connection succeeds in bootstrap().
// --------------------------------------------------

let sessionMiddleware = null;

app.use(
  (req, res, next) => {
    if (!sessionMiddleware) {
      return res.status(503).send(
        "MongoDB session store is not ready."
      );
    }

    return sessionMiddleware(
      req,
      res,
      next
    );
  }
);

// --------------------------------------------------
// Shared template data
// --------------------------------------------------

app.use(
  (req, res, next) => {
    res.locals.fullName =
      FULL_NAME;

    res.locals.mssv =
      MSSV;

    res.locals.vatPercent =
      VAT_PERCENT;

    res.locals.productPrefix =
      PRODUCT_PREFIX;

    res.locals.isLoggedIn =
      Boolean(req.session.user);

    res.locals.currentUser =
      req.session.user || null;

    next();
  }
);

// --------------------------------------------------
// Home
// --------------------------------------------------

app.get(
  "/",
  (req, res) => {
    res.render(
      "home",
      {
        title: "Quản lý sách",
        sessionViews:
          req.session.views || 0
      }
    );
  }
);

// --------------------------------------------------
// Login
// --------------------------------------------------

app.get(
  "/login",
  (req, res) => {
    req.session.user = {
      name: FULL_NAME,
      mssv: MSSV
    };

    req.session.views = 0;

    req.session.save(
      (err) => {
        if (err) {
          console.error(
            "Session save error:",
            err
          );

          return res
            .status(500)
            .send(
              "Không thể tạo session."
            );
        }

        return res.redirect(
          "/books"
        );
      }
    );
  }
);

// --------------------------------------------------
// Logout
// --------------------------------------------------

app.get(
  "/logout",
  (req, res) => {
    req.session.destroy(
      (err) => {
        if (err) {
          console.error(
            "Session destroy error:",
            err
          );

          return res
            .status(500)
            .send(
              "Không thể đăng xuất."
            );
        }

        res.clearCookie(
          "bookcloud.sid"
        );

        return res.redirect(
          "/"
        );
      }
    );
  }
);

// --------------------------------------------------
// Session test
// --------------------------------------------------

app.get(
  "/session-test",
  (req, res) => {
    req.session.views =
      (req.session.views || 0) + 1;

    res.render(
      "session",
      {
        title:
          "Session Test",

        sessionId:
          req.sessionID,

        sessionViews:
          req.session.views,

        sessionData:
          req.session.user || null
      }
    );
  }
);

// --------------------------------------------------
// READ BOOKS
// --------------------------------------------------

app.get(
  "/books",
  async (req, res) => {
    try {
      const readDb =
        getReadDb();

      const books =
        await readDb
          .collection("books")
          .find({})
          .sort({
            createdAt: -1
          })
          .toArray();

      req.session.views =
        (req.session.views || 0) + 1;

      return res.render(
        "books",
        {
          title:
            "Danh sách sách",

          books,

          error: null,

          success: null,

          sessionViews:
            req.session.views
        }
      );
    } catch (error) {
      console.error(
        "READ ERROR:",
        error
      );

      return res
        .status(500)
        .render(
          "books",
          {
            title:
              "Danh sách sách",

            books: [],

            error:
              "Không thể đọc dữ liệu từ MongoDB Atlas.",

            success: null,

            sessionViews:
              req.session.views || 0
          }
        );
    }
  }
);

// --------------------------------------------------
// WRITE BOOK
// --------------------------------------------------

app.post(
  "/books",
  async (req, res) => {
    try {
      if (!req.session.user) {
        return res
          .status(401)
          .render(
            "books",
            {
              title:
                "Danh sách sách",

              books: [],

              error:
                "Bạn phải đăng nhập trước khi thêm sách.",

              success: null,

              sessionViews:
                req.session.views || 0
            }
          );
      }

      const productCode =
        String(
          req.body.productCode || ""
        ).trim();

      const name =
        String(
          req.body.name || ""
        ).trim();

      const price =
        Number(
          req.body.price
        );

      if (
        !productCode ||
        !name ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return res
          .status(400)
          .render(
            "books",
            {
              title:
                "Danh sách sách",

              books: [],

              error:
                "Dữ liệu không hợp lệ.",

              success: null,

              sessionViews:
                req.session.views || 0
            }
          );
      }

      if (
        !productCode.startsWith(
          PRODUCT_PREFIX
        )
      ) {
        return res
          .status(400)
          .render(
            "books",
            {
              title:
                "Danh sách sách",

              books: [],

              error:
                `Mã sản phẩm phải bắt đầu bằng ${PRODUCT_PREFIX}.`,

              success: null,

              sessionViews:
                req.session.views || 0
            }
          );
      }

      const vatAmount =
        Number(
          (
            price * VAT_RATE
          ).toFixed(2)
        );

      const priceAfterTax =
        Number(
          (
            price + vatAmount
          ).toFixed(2)
        );

      const book = {
        productCode,

        name,

        originalPrice:
          price,

        vatPercent:
          VAT_PERCENT,

        vatAmount,

        priceAfterTax,

        createdBy:
          MSSV,

        createdAt:
          new Date()
      };

      const writeDb =
        getWriteDb();

      await writeDb
        .collection("books")
        .insertOne(book);

      return res.redirect(
        "/books"
      );
    } catch (error) {
      console.error(
        "WRITE ERROR:",
        error
      );

      return res
        .status(500)
        .send(
          "Không thể ghi dữ liệu bằng WRITE account."
        );
    }
  }
);

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use(
  (req, res) => {
    res
      .status(404)
      .send(
        "404 - Page not found"
      );
  }
);

// --------------------------------------------------
// Start
// --------------------------------------------------

async function bootstrap() {
  try {
    console.log(
      "Starting application..."
    );

    console.log(
      `MSSV: ${MSSV}`
    );

    console.log(
      `Database: ${DB_NAME}`
    );

    console.log(
      `Product prefix: ${PRODUCT_PREFIX}`
    );

    console.log(
      `VAT: ${VAT_PERCENT}%`
    );

    // ----------------------------------------------
    // Connect MongoDB first
    // ----------------------------------------------

    await connectDatabases();

    // ----------------------------------------------
    // Create MongoDB session store AFTER
    // MongoDB WRITE client is connected
    // ----------------------------------------------

    const writeClient =
      getWriteClient();

    const mongoStore =
      MongoStore.create({
        client:
          writeClient,

        dbName:
          DB_NAME,

        collectionName:
          "sessions",

        ttl:
          7 * 24 * 60 * 60,

        autoRemove:
          "disabled"
      });

    sessionMiddleware =
      session({
        name:
          "bookcloud.sid",

        secret:
          process.env.SESSION_SECRET,

        resave:
          false,

        saveUninitialized:
          false,

        store:
          mongoStore,

        cookie: {
          httpOnly:
            true,

          secure:
            process.env.NODE_ENV ===
            "production",

          sameSite:
            "lax",

          maxAge:
            7 * 24 * 60 * 60 * 1000
        }
      });

    // ----------------------------------------------
    // Start HTTP server
    // ----------------------------------------------

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Server running at http://localhost:${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Application startup failed:",
      error
    );

    process.exit(1);
  }
}

// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

async function shutdown(signal) {
  console.log(
    `${signal} received.`
  );

  try {
    await closeDatabases();
  } finally {
    process.exit(0);
  }
}

process.on(
  "SIGINT",
  () => {
    shutdown("SIGINT");
  }
);

process.on(
  "SIGTERM",
  () => {
    shutdown("SIGTERM");
  }
);

// --------------------------------------------------
// Start
// --------------------------------------------------

bootstrap();