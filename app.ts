import { Telegraf } from "telegraf";
import { LocalStorage } from "node-localstorage";
import schedule from "node-schedule";
import axios from "axios";
require("dotenv").config();
const localStorage = new LocalStorage("./storage");
function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
class Bot {
  TOKEN = process.env.BOT_TOKEN;
  chat_id = process.env.CHAT_ID;
  apiKey = process.env.API_KEY;
  apiSecret = process.env.API_SECRET;
  bot: Telegraf | null = null;
  rule: schedule.RecurrenceRule;
  job: schedule.Job | null = null;
  url = "https://thisiskida.com/wp-json/wc/v3/orders";
  localstorage: LocalStorage;
  constructor(localstorage: LocalStorage) {
    if (this.TOKEN) this.bot = new Telegraf(this.TOKEN);
    this.rule = new schedule.RecurrenceRule();
    this.rule.second = 0;
    this.localstorage = localstorage;
  }
  async parse() {
    try {
      const res = await axios.get(this.url, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64"),
        },
        params: {
          after: this.localstorage.getItem("last_datetime"),
          per_page: this.localstorage.getItem("last_datetime") ? 100 : 1,
          page: 1,
        },
      });
      if (res.data && res.data.length > 0) {
        this.localstorage.setItem("last_datetime", res.data[0].date_created);
        await this.sendMessage(res.data);
      }
    } catch (e) {
      console.log(e);
    }
  }

  async sendMessage(data: any[]) {
    for (let i = 0; i < data.length; i++) {
      try {
        const order = data[i];
        let message = `#new_order ${order.id}\n`;
        message += `👩${order?.billing?.first_name} ${order?.billing?.last_name} 📞${order?.billing?.phone}\n`;
        message += `🏠${order?.shipping?.state} ${order?.shipping?.city}\n\n`;
        if (order.line_items) {
          order.line_items.map((item: any) => {
            message += `•${item.name}  ${item.quantity} ${item.total}\n`;
          });
        }
        if (order.meta_data) {
          const source = order.meta_data.find(
            (meta: any) => meta.key == "pys_enrich_data",
          )?.value.pys_source;
          message += `👁️${source}`;
        }
        if (this.chat_id)
          this.bot?.telegram.sendMessage(this.chat_id, message, {
            parse_mode: "HTML",
          });
        await sleep(2000);
      } catch (e) {
        console.log("cant send message", e);
      }
    }
  }
  async start() {
    this.job = schedule.scheduleJob(this.rule, () => {
      if (this.apiKey && this.apiSecret) this.parse();
    });
    this.bot?.launch();
  }
}

const bot = new Bot(localStorage);

bot.start();
