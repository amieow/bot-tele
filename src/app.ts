// replace with your telegram bot token
const BOT_TOKEN = '6428398787:AAEo8Ga6y64kxD0Z95wC7bXk7REVOCjHhCg'
//  YOU CAN CONTACT THE DEVELOPER WITH THIS LINK (DONT CHANGE)
const DEVELOPER_BOT = 'https://t.me/amieowdev'
const DEVELOPER_NAME = 'amieow'
const DEVELOPER_ID = 5148068147
const CONTACT_DEVELOPER = [
  {
    display: 'telegram',
    link: DEVELOPER_BOT,
  },
  {
    display: 'instagram',
    link: 'https://www.instagram.com/amieow.env',
  },
  {
    display: 'github',
    link: 'https://github.com/amieow',
  },
]
// REPLACE THIS TO YOUR TELEGRAM ID TO BE ABLE TO SEND FEEDBACK
const OWNER_ID = 5148068147
let VISITORS: {
  id: number | undefined
  name: string
  username: string | undefined
  visitIn: Date
}[] = []

// js Processer
import { cwd } from 'process'
import { resolve } from 'path'
import { readFileSync, readdirSync } from 'fs'
import { load } from 'js-yaml'
import stringSimilarity from 'string-similarity'
//grammy Dependencies
import { run } from '@grammyjs/runner'
import { I18n, I18nContext } from '@grammyjs/i18n'
import { Context as BaseContext, Bot, Keyboard, session } from 'grammy'
import { Menu } from '@grammyjs/menu'
import { ignoreOld, sequentialize } from 'grammy-middlewares'
type sessionType = {
  history: string[]
  language: string
  faq: {
    currentPage: number
  }
}
interface YamlWithName {
  name: string
}

class Context extends BaseContext {
  session!: sessionType
  i18n!: I18nContext
  // Initialize cvt in the constructor
  constructor(update: any, api: any, me: any) {
    super(update, api, me)
  }
  replyWithLocalization: this['reply'] = (text, other, ...rest) => {
    text = this.i18n.t(text)
    return this.reply(
      text,
      {
        parse_mode: 'HTML',
        ...other,
      },
      ...rest
    )
  }
}
const bot = new Bot<Context>(BOT_TOKEN, {
  ContextConstructor: Context,
})

const i18n = new I18n({
  defaultLanguageOnMissing: true,
  directory: resolve(cwd(), 'locales'),
  defaultLanguage: 'en',
})
function checkAvaibleRepository(ctx: Context, repoKey: string) {
  return i18n.resourceKeys(ctx.session.language).includes(repoKey)
}

function CustomKeyboard(ctx: Context, textArray: string[] = []) {
  const keyboard = new Keyboard()
  if (textArray.length > 0) {
    textArray.forEach((text) => {
      keyboard.text(text).row()
    })
  }
  keyboard.resized()
  keyboard.oneTime()
  return keyboard
}
function initial(): sessionType {
  return {
    history: [],
    language: 'en',
    faq: {
      currentPage: 0,
    },
  }
}

async function runApp() {
  console.log('Starting app...')
  // ERROR HANDLE \\
  async function handleErrorWhileSending(
    ctx: Context,
    update: {
      message_id: number
      chat_id: number | string
    },
    callback:
      | (() => Promise<void>)
      | {
          errorMsg?: string
        },
    cb?: () => Promise<void>
  ) {
    try {
      if (cb) {
        await cb()
      } else if (typeof callback != 'object') {
        await callback()
      }
    } catch (error) {
      console.error(error)
      if (typeof callback == 'object' && callback.errorMsg) {
        await ctx.api.editMessageText(
          update.chat_id,
          update.message_id,
          callback.errorMsg
        )
        return
      }
      await ctx.api.editMessageText(
        update.chat_id,
        update.message_id,
        ctx.i18n.t('error-sending-msg')
      )
    }
  }
  bot
    // Middlewares
    .use(i18n.middleware())
    .use(session({ initial }))
    .use(ignoreOld())
    .use(sequentialize())
    //custom Middlewares
    .use(async (ctx, next) => {
      ctx.i18n.locale(ctx.session.language || 'en')
      await next()
    })
  // ADD VISITORS DATA
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      VISITORS.push({
        id: ctx.from.id,
        name: ctx.from.first_name + ctx.from.last_name,
        visitIn: new Date(),
        username: ctx.from.username,
      })
    }
    await next()
  })
  //ALL THE REGEX HERE \\
  const extractIdfromreply = /fromId : (\d+)/

  //END THE REGEX HERE \\

  // MENUS START ALL HERE \\
  const MAIN_MENU = [
    'Contact',
    'FAQ',
    'About Developer',
    'My Services',
  ] as const
  const faqMenuNoMore = new Menu<Context>('FAQ-no-more').text(
    "i still don't understand",
    async (ctx) => {
      await ctx.replyWithLocalization('give_question', {
        reply_markup: {
          force_reply: true,
        },
      })
    }
  )
  bot.use(faqMenuNoMore)

  const faqMenu = new Menu<Context>('FAQ')
    .text("i still don't understand", async (ctx) => {
      await ctx.replyWithLocalization('give_question', {
        reply_markup: {
          force_reply: true,
        },
      })
    })
    .text('more', async (ctx) => {
      ctx.session.faq.currentPage += 1
      const Cpage = ctx.session.faq.currentPage
      if (!checkAvaibleRepository(ctx, `faq-${Cpage}`)) {
        await ctx.reply('cannot find more question')
        return
      }
      if (
        checkAvaibleRepository(ctx, `faq-${ctx.session.faq.currentPage + 1}`)
      ) {
        await ctx.replyWithLocalization(`faq-${Cpage}`, {
          reply_markup: faqMenu,
        })
        return
      }
      await ctx.replyWithLocalization(`faq-${Cpage}`, {
        reply_markup: faqMenuNoMore,
      })
    })
  bot.use(faqMenu)

  const contactMenu = new Menu<Context>('contact')
  CONTACT_DEVELOPER.forEach((contact, i) => {
    contactMenu.url(contact.display, contact.link)
    if (i % 2 != 0) {
      contactMenu.row()
    }
  })
  bot.use(contactMenu)
  const languageMenu = new Menu<Context>('language')

  const languageMenuInit = () => {
    const localeFilePaths = readdirSync(resolve(cwd(), 'locales'))
    const localeFile = (path: string) => {
      return load(
        readFileSync(resolve(cwd(), 'locales', path), 'utf8')
      ) as YamlWithName
    }
    localeFilePaths.forEach((localeFilePath, index) => {
      const localeCode = localeFilePath.split('.')[0]
      const localeName = localeFile(localeFilePath).name
      languageMenu.text(localeName, async (ctx: Context) => {
        ctx.i18n.locale(localeCode)
        ctx.session.language = localeCode
        await ctx.replyWithLocalization('menu', {
          reply_markup: CustomKeyboard(ctx, MAIN_MENU as any),
        })
      })
      if (index % 2 != 0) {
        languageMenu.row()
      }
    })
  }
  languageMenuInit()
  bot.use(languageMenu)
  // MENU END HERE \\

  // Commands
  bot.command('start', (ctx) => {
    ctx.replyWithLocalization('greeting', {
      reply_markup: languageMenu,
    })
  })
  //handle event \\
  const privateChat = bot.filter(
    (x) => x.message?.chat.type == 'private' && !x.from?.is_bot
  )

  privateChat.hears(MAIN_MENU as any, async (ctx) => {
    switch (ctx.match as (typeof MAIN_MENU)[number]) {
      case 'Contact': {
        await ctx.replyWithLocalization('contact', {
          reply_markup: contactMenu,
        })
        break
      }
      case 'About Developer': {
        await ctx.replyWithLocalization('about_developer')
        break
      }
      case 'FAQ': {
        const faqCurrentPage = `faq-${ctx.session.faq.currentPage}`
        const t = checkAvaibleRepository(
          ctx,
          `faq-${ctx.session.faq.currentPage + 1}`
        )
        console.log({ t })
        if (t) {
          await ctx.replyWithLocalization(faqCurrentPage, {
            reply_markup: faqMenu,
          })
          break
        }
        await ctx.replyWithLocalization(faqCurrentPage, {
          reply_markup: faqMenuNoMore,
        })
        break
      }
      case 'My Services': {
        await ctx.replyWithLocalization('services')
        break
      }
      default:
        break
    }
  })
  privateChat.on('message:text', async (ctx) => {
    const msgId = ctx.msg.chat.id
    if (ctx.msg.reply_to_message?.from?.id == ctx.me.id) {
      const similarity = stringSimilarity.compareTwoStrings(
        ctx.msg.reply_to_message.text || '',
        ctx.i18n.t('give_question')
      )
      console.log(similarity)
      if (similarity > 0.9) {
        await ctx.react('❤')
        const updateMsg = await ctx.reply('sending to developer...')
        await handleErrorWhileSending(
          ctx,
          { chat_id: ctx.from.id, message_id: msgId },
          async () => {
            await ctx.api.sendMessage(
              DEVELOPER_ID,
              `Question from ${
                ctx.msg.from.first_name + ' ' + (ctx.msg.from.last_name || '')
              }\n` +
                `chat Id : ${ctx.msg.from.id}\nlangguage_code : ${ctx.msg.from.language_code}` +
                `\n-----\tstart\t-----\n${ctx.message.text}\n-----\tend\t-----`
            )
            console.log('BOT BERHASIL SEND PESAN KE DEVELOPER')
            await ctx.api.editMessageText(
              msgId,
              updateMsg.message_id,
              ctx.i18n.t('question_send')
            )
          }
        )
        return
      }
      const replyId = ctx.msg.reply_to_message.text?.match(extractIdfromreply)
      if (replyId && ctx.msg.from.id == DEVELOPER_ID) {
        const id = replyId[1]
        const updateMsg = await ctx.reply('bentar gan')
        await ctx.api.sendMessage(
          id,
          ctx.i18n.t('question_reply_developer') + '\n' + ctx.msg.text,
          {
            parse_mode: 'HTML',
          }
        )
        await ctx.api.editMessageText(
          DEVELOPER_ID,
          updateMsg.message_id,
          'kekirim gan Mantaps'
        )
      }
    }
  })
  bot.use(privateChat)
  // Errors
  bot.catch(console.error)
  // Start bot
  await bot.init()
  run(bot)
  console.info(`Bot ${bot.botInfo.username} is up and running`)
}
runApp()
