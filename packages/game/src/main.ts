import { DemoApplication } from './demo-application.ts'

const application = await DemoApplication.create()
application.start()
