package expo.modules.smsreader

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads incoming SMS from the device inbox so the app can turn bank
 * notifications into transactions. Read-only: never sends or deletes SMS.
 */
class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    Function("hasPermission") {
      val ctx = appContext.reactContext ?: return@Function false
      ctx.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("readInbox") { sinceMs: Double, limit: Int ->
      val ctx = appContext.reactContext ?: throw IllegalStateException("No React context")
      if (ctx.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("READ_SMS permission not granted")
      }
      val out = ArrayList<Map<String, Any?>>()
      val cursor = ctx.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("_id", "address", "body", "date"),
        "date > ?",
        arrayOf(sinceMs.toLong().toString()),
        "date DESC"
      )
      cursor?.use { c ->
        val idIdx = c.getColumnIndexOrThrow("_id")
        val addrIdx = c.getColumnIndexOrThrow("address")
        val bodyIdx = c.getColumnIndexOrThrow("body")
        val dateIdx = c.getColumnIndexOrThrow("date")
        while (c.moveToNext() && out.size < limit) {
          out.add(
            mapOf(
              "id" to c.getString(idIdx),
              "address" to (c.getString(addrIdx) ?: ""),
              "body" to (c.getString(bodyIdx) ?: ""),
              "date" to c.getLong(dateIdx).toDouble()
            )
          )
        }
      }
      out
    }
  }
}
